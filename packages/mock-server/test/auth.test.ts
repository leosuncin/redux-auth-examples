/* eslint-disable @typescript-eslint/naming-convention, unicorn/prefer-node-protocol */
import http from 'http';
import { createServer } from '@mswjs/http-middleware';
import anyTest, { type TestFn } from 'ava';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { request, spec } from 'pactum';
import listen from 'test-listen';

import {
  buildLogin,
  buildRegister,
  loginHandler,
  meHandler,
  registerHandler,
  type Register,
} from '~/index';
import { errorResponseSchema, isoDateRegex } from '~/utils';

type TestContext = { newUser: Register };

const test = anyTest as TestFn<TestContext>;
const httpServer = http.createServer(
  createServer(registerHandler, loginHandler, meHandler),
);

const validationErrors = test.macro(
  async (
    _t,
    url: '/auth/register' | '/auth/login',
    body: Record<string, unknown>,
    errors: Record<string, string[]>,
  ) => {
    await spec()
      .post(url)
      .withJson(body)
      .expectStatus(StatusCodes.UNPROCESSABLE_ENTITY)
      .expectJsonSchema(errorResponseSchema)
      .expectJsonMatch({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        error: ReasonPhrases.UNPROCESSABLE_ENTITY,
        errors,
      })
      .toss();
  },
);

const authenticationErrorLogin = test.macro(
  async (_t, body: Record<string, unknown>) => {
    await spec()
      .post('/auth/login')
      .withJson(body)
      .expectStatus(StatusCodes.UNAUTHORIZED)
      .expectJsonSchema(errorResponseSchema)
      .expectJsonMatch({
        statusCode: StatusCodes.UNAUTHORIZED,
        error: ReasonPhrases.UNAUTHORIZED,
        message: 'Incorrect credentials',
      })
      .toss();
  },
);

test.before(async (t) => {
  t.context.newUser = buildRegister({ password: 'Pa$$w0rd!' });
  const url = await listen(httpServer);

  request.setBaseUrl(url);
});

test.after(() => {
  httpServer.close();
});

test.serial('register a new user', async (t) => {
  await spec()
    .post('/auth/register')
    .withJson(t.context.newUser)
    .expectStatus(StatusCodes.ACCEPTED)
    .expectJsonLike({
      token: 'typeof $V === "string"',
      user: {
        id: 'typeof $V === "number"',
        name: t.context.newUser.name,
        email: t.context.newUser.email,
        createdAt: isoDateRegex,
        updatedAt: isoDateRegex,
      },
    })
    .expectHeaderContains('authorization', /Bearer\s.+/)
    .expectCookiesLike({
      token: 'typeof $V === "string"',
      HttpOnly: null,
      SameSite: 'Strict',
    })
    .stores('newUser', '.user')
    .toss();
});

test(
  'validate that register requires all the fields',
  validationErrors,
  '/auth/register',
  {
    name: null,
    email: null,
    password: null,
  },
  {
    name: ['The name must be a string'],
    email: ['The email must be a string'],
    password: ['The password must be a string'],
  },
);

test(
  'validate that register does not accept empty values',
  validationErrors,
  '/auth/register',
  {
    name: '',
    email: '',
    password: '',
  },
  {
    name: ['The name should not be empty'],
    email: ['The email should not be empty'],
    password: ['The password should not be empty'],
  },
);

test(
  'validate that register does not accept invalid email and short password',
  validationErrors,
  '/auth/register',
  buildRegister({
    email: 'email',
    password: 'short',
  }),
  {
    email: ['The email should be an email address'],
    password: ['The password should have at least 8 characters'],
  },
);

test.serial(
  'validate that can not register a duplicate user',
  validationErrors,
  '/auth/register',
  buildRegister({
    email: '$S{newUser.email}',
    password: String.fromCodePoint(
      ...Array.from({ length: 56 }, () =>
        Math.trunc(Math.random() * (126 - 33)),
      ),
    ),
  }),
  {
    email: ['The email is already registered'],
    password: ['The password should have less than 55 characters'],
  },
);

test.serial('login an user', async (t) => {
  await spec()
    .post('/auth/login')
    .withJson({
      email: t.context.newUser.email,
      password: t.context.newUser.password,
    })
    .expectStatus(StatusCodes.OK)
    .expectJsonLike({
      token: 'typeof $V === "string"',
      user: {
        id: '$S{newUser.id}',
        name: '$S{newUser.name}',
        email: '$S{newUser.email}',
        createdAt: isoDateRegex,
        updatedAt: isoDateRegex,
      },
    })
    .expectHeaderContains('authorization', /Bearer\s.+/)
    .expectCookiesLike({
      token: 'typeof $V === "string"',
      HttpOnly: null,
      SameSite: 'Strict',
    })
    .returns((context) => context.res.headers.authorization)
    .stores('token', '.token')
    .toss();
});

test(
  'validate that login requires all the fields',
  validationErrors,
  '/auth/login',
  {
    email: null,
    password: null,
  },
  {
    email: ['The email must be a string'],
    password: ['The password must be a string'],
  },
);

test(
  'validate that login does not accept empty values',
  validationErrors,
  '/auth/login',
  {
    email: '',
    password: '',
  },
  {
    email: ['The email should not be empty'],
    password: ['The password should not be empty'],
  },
);

test(
  'validate that login does not accept invalid email and short password',
  validationErrors,
  '/auth/login',
  {
    email: 'email',
    password: 'short',
  },
  {
    email: ['The email should be an email address'],
    password: ['The password should have at least 8 characters'],
  },
);

test('fail to login with random user', authenticationErrorLogin, buildLogin());

test.serial(
  'fail to login with incorrect password',
  authenticationErrorLogin,
  buildLogin({ email: '$S{newUser.email}' }),
);

test.serial('get current user', async () => {
  await spec()
    .get('/auth/me')
    .withHeaders('Authorization', 'Bearer $S{token}')
    .expectStatus(StatusCodes.OK)
    .expectJsonLike({
      id: '$S{newUser.id}',
      name: '$S{newUser.name}',
      email: '$S{newUser.email}',
      createdAt: isoDateRegex,
      updatedAt: isoDateRegex,
    })
    .toss();
});

test('fail to get current user when unauthenticated', async () => {
  await spec()
    .get('/auth/me')
    .expectStatus(StatusCodes.UNAUTHORIZED)
    .expectJsonSchema(errorResponseSchema)
    .expectJson({
      statusCode: StatusCodes.UNAUTHORIZED,
      error: ReasonPhrases.UNAUTHORIZED,
      message: 'Unauthenticated',
    })
    .toss();
});
