import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { rest } from 'msw';

import db from '~/db';
import {
  decodeToken,
  delayedResponse,
  encodeToken,
  unauthorizedResponse,
  type ApiError,
} from '~/utils';

export type Register = {
  name: string;
  email: string;
  password: string;
};

export type Login = {
  email: string;
  password: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type Errors<Body extends Register | Login> = Partial<
  Record<Body extends Register ? keyof Register : keyof Login, string[]>
>;

function validateBody<Body extends Register | Login>(body: Body): Errors<Body> {
  const { email, password } = body;
  const errors: Partial<Record<string, string[]>> = {};
  const isRegister = (body: Record<string, unknown>): body is Register =>
    'name' in body;

  if (isRegister(body)) {
    const { name } = body;

    if (typeof name !== 'string') {
      errors.name = ['The name must be a string'];
    } else if (name.length === 0 || name.trim().length === 0) {
      errors.name = ['The name should not be empty'];
    }
  }

  if (typeof email !== 'string') {
    errors.email = ['The email must be a string'];
  } else if (email.length === 0 || email.trim().length === 0) {
    errors.email = ['The email should not be empty'];
  } else if (!email.includes('@')) {
    errors.email = ['The email should be an email address'];
  } else if (
    isRegister(body) &&
    db.user.count({ where: { email: { equals: email } } }) > 0
  ) {
    errors.email = ['The email is already registered'];
  }

  if (typeof password !== 'string') {
    errors.password = ['The password must be a string'];
  } else if (password.length === 0 || password.trim().length === 0) {
    errors.password = ['The password should not be empty'];
  } else if (password.length < 8) {
    errors.password = ['The password should have at least 8 characters'];
  } else if (password.length > 55) {
    errors.password = ['The password should have less than 55 characters'];
  }

  return errors;
}

export const registerHandler = rest.post<Register>(
  '*/auth/register',
  (request, response, context) => {
    const { name, email, password } = request.body;
    const errors = validateBody(request.body);

    if (Object.values(errors).some((value) => Array.isArray(value))) {
      return response(
        context.status(StatusCodes.UNPROCESSABLE_ENTITY),
        context.json<ApiError>({
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          error: ReasonPhrases.UNPROCESSABLE_ENTITY,
          message: 'Validation errors',
          errors,
        }),
      );
    }

    const { password: _, ...user } = db.user.create({
      name,
      email: email.trim().toLowerCase(),
      password,
    });
    const token = encodeToken(user);

    return delayedResponse(
      context.status(StatusCodes.ACCEPTED),
      context.set('Authorization', `Bearer ${token}`),
      context.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
      }),
      context.json(user),
    );
  },
);

export const loginHandler = rest.post<Login>(
  '*/auth/login',
  (request, response, context) => {
    const { email, password } = request.body;
    const errors = validateBody(request.body);

    if (Object.values(errors).some((value) => Array.isArray(value))) {
      return response(
        context.status(StatusCodes.UNPROCESSABLE_ENTITY),
        context.json<ApiError>({
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          error: ReasonPhrases.UNPROCESSABLE_ENTITY,
          message: 'Validation errors',
          errors,
        }),
      );
    }

    const user = db.user.findFirst({ where: { email: { equals: email } } });

    if (!user) {
      return response(
        context.status(StatusCodes.UNAUTHORIZED),
        context.json<ApiError>({
          statusCode: StatusCodes.UNAUTHORIZED,
          error: ReasonPhrases.UNAUTHORIZED,
          message: 'Incorrect credentials',
        }),
      );
    }

    if (password !== user.password) {
      return response(
        context.status(StatusCodes.UNAUTHORIZED),
        context.json<ApiError>({
          statusCode: StatusCodes.UNAUTHORIZED,
          error: ReasonPhrases.UNAUTHORIZED,
          message: 'Incorrect credentials',
        }),
      );
    }

    const token = encodeToken(user);

    return delayedResponse(
      context.set('Authorization', `Bearer ${token}`),
      context.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
      }),
      context.json({
        ...user,
        password: undefined,
      }),
    );
  },
);

export const meHandler = rest.get(
  '*/auth/me',
  (request, _response, context) => {
    const authorization = request.headers.get('Authorization');
    let { token } = request.cookies;

    if (!token || !authorization || !/Bearer\s+.+/.test(authorization)) {
      return unauthorizedResponse();
    }

    token = token ? token : authorization.split(' ')[1]!;

    const user = decodeToken(token);

    if (!user) {
      return unauthorizedResponse();
    }

    return delayedResponse(
      context.json({
        ...user,
        password: undefined,
      }),
    );
  },
);
