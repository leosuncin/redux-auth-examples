/* eslint-disable unicorn/prefer-node-protocol */
import http from 'http';
import { createServer } from '@mswjs/http-middleware';
import anyTest, { type TestFn } from 'ava';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { e2e, request, spec } from 'pactum';
import listen from 'test-listen';

import db, { type User } from '~/db';
import {
  buildCreateTask,
  buildRegister,
  buildUpdateTask,
  createTaskHandler,
  listTaskHandler,
  removeTaskHandler,
  updateTaskHandler,
} from '~/index';
import { encodeToken, errorResponseSchema, isoDateRegex } from '~/utils';

const test = anyTest as TestFn<{ user: User }>;
const testCase = e2e('Task CRUD');
const httpServer = http.createServer(
  createServer(
    createTaskHandler,
    listTaskHandler,
    removeTaskHandler,
    updateTaskHandler,
  ),
);

const validationErrors = test.macro({
  async exec(
    t,
    path: `${'POST /tasks' | 'PUT /tasks/$S{task.id}'}`,
    body: Record<string, unknown>,
    errors: Record<string, string[]>,
  ) {
    const [method, url] = path.split(' ');
    const token = encodeToken(t.context.user);

    await spec()
      .withPath(url!)
      .withMethod(method!)
      .withHeaders('Authorization', `Bearer ${token}`)
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
  title(providedTitle, _path, body) {
    return `${providedTitle ?? ''} with body ${JSON.stringify(body)}`;
  },
});
const requireAuthentication = test.macro(
  async (
    _t,
    path: `${
      | `${'GET' | 'POST'} /tasks`
      | `${'DELETE' | 'PUT'} /tasks/$S{task.id}`}`,
  ) => {
    const [method, url] = path.split(' ');

    await spec()
      .withPath(url!)
      .withMethod(method!)
      .expectStatus(StatusCodes.UNAUTHORIZED)
      .expectJsonSchema(errorResponseSchema)
      .expectJsonMatch({
        statusCode: StatusCodes.UNAUTHORIZED,
        error: ReasonPhrases.UNAUTHORIZED,
        message: 'Unauthenticated',
      })
      .toss();
  },
);
const notFoundError = test.macro(
  async (t, path: `${'DELETE' | 'PUT'} /tasks/${number}`) => {
    const [method, url] = path.split(' ');
    const token = encodeToken(t.context.user);

    await spec()
      .withPath(url!)
      .withMethod(method!)
      .withHeaders('Authorization', `Bearer ${token}`)
      .withBody({ text: 'error', done: true })
      .expectStatus(StatusCodes.NOT_FOUND)
      .expectJsonSchema(errorResponseSchema)
      .expectJsonMatch({
        statusCode: StatusCodes.NOT_FOUND,
        error: ReasonPhrases.NOT_FOUND,
      })
      .toss();
  },
);

test.before(async (t) => {
  const url = await listen(httpServer);
  t.context.user = db.user.create(buildRegister()) as User;

  request.setBaseUrl(url);
});

test.after(async () => {
  await testCase.cleanup();
  httpServer.close();
});

test.serial('create a new task', async (t) => {
  const data = buildCreateTask();
  const token = encodeToken(t.context.user);

  await testCase
    .step('Add task')
    .spec()
    .post('/tasks')
    .withHeaders('Authorization', `Bearer ${token}`)
    .withJson(data)
    .expectStatus(StatusCodes.CREATED)
    .expectJsonLike({
      id: 'typeof $V === "number"',
      text: data.text,
      done: false,
      createdAt: isoDateRegex,
      updatedAt: isoDateRegex,
    })
    .stores('task', '.')
    .clean()
    .delete('/tasks/{taskId}')
    .withPathParams('taskId', '$S{task.id}')
    .withHeaders('Authorization', `Bearer ${token}`)
    .expectStatus(StatusCodes.NO_CONTENT)
    .toss();
});

test(
  'validate that requires the text on create',
  validationErrors,
  'POST /tasks',
  {},
  { text: ['The text must be a string'] },
);

test(
  'validate that the text is not empty on create',
  validationErrors,
  'POST /tasks',
  { text: '' },
  { text: ['The text should not be empty'] },
);

test(
  'require to be authenticated for creating tasks',
  requireAuthentication,
  'POST /tasks',
);

test.serial('list all of the tasks', async (t) => {
  const token = encodeToken(t.context.user);

  await testCase
    .step('List all the tasks')
    .spec()
    .get('/tasks')
    .withHeaders('Authorization', `Bearer ${token}`)
    .expectStatus(StatusCodes.OK)
    .expectJsonLike('.', '$V.length >= 1')
    .toss();
});

test(
  'require to be authenticated for listing tasks',
  requireAuthentication,
  'GET /tasks',
);

test.serial('update one task', async (t) => {
  const data = buildUpdateTask();
  const token = encodeToken(t.context.user);

  await testCase
    .step('Update a task')
    .spec()
    .put('/tasks/{taskId}')
    .withPathParams('taskId', '$S{task.id}')
    .withHeaders('Authorization', `Bearer ${token}`)
    .withJson(data)
    .expectStatus(StatusCodes.OK)
    .expectJsonLike({
      id: '$S{task.id}',
      text: data.text ?? 'typeof $V === "string"',
      done: data.done ?? 'typeof $V === "boolean"',
      createdAt: isoDateRegex,
      updatedAt: isoDateRegex,
    })
    .toss();
});

test(
  'validate the types of the fields on update',
  validationErrors,
  'PUT /tasks/$S{task.id}',
  { text: false, done: '' },
  {
    text: ['The text must be a string'],
    done: ['The `done` must be a boolean'],
  },
);

test(
  'validate the type of the done on update',
  validationErrors,
  'PUT /tasks/$S{task.id}',
  {},
  {
    text: ['The text must be a string'],
    done: ['The `done` must be a boolean'],
  },
);

test(
  'validate that the text is not empty on update',
  validationErrors,
  'PUT /tasks/$S{task.id}',
  { text: '  ' },
  { text: ['The text should not be empty'] },
);

test(
  'require to be authenticated for updating tasks',
  requireAuthentication,
  'PUT /tasks/$S{task.id}',
);

test(
  'fail to update when task not exist',
  notFoundError,
  `PUT /tasks/${Date.now()}`,
);

test(
  'require to be authenticated for removing tasks',
  requireAuthentication,
  'DELETE /tasks/$S{task.id}',
);

test(
  'fail to remove when task not exist',
  notFoundError,
  `DELETE /tasks/${Date.now()}`,
);
