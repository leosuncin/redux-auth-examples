import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { createResponseComposition, context, type RestRequest } from 'msw';

import db from '~/db';

export type ApiError =
  | {
      statusCode: StatusCodes;
      error: ReasonPhrases;
      message: string;
    }
  | {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY;
      error: ReasonPhrases.UNPROCESSABLE_ENTITY;
      message: string;
      errors: Record<string, string[]>;
    };

export const delayedResponse = createResponseComposition(undefined, [
  context.delay('real'),
]);

export const unauthorizedResponse = createResponseComposition(undefined, [
  context.status(StatusCodes.UNAUTHORIZED),
  context.json<ApiError>({
    statusCode: StatusCodes.UNAUTHORIZED,
    error: ReasonPhrases.UNAUTHORIZED,
    message: 'Unauthenticated',
  }),
]);

export function encodeToken(user: { id: number }): string {
  return JSON.stringify({ sub: user.id });
}

export function extractTokenFromRequest(
  request: RestRequest,
): string | undefined {
  const authorization = request.headers.get('Authorization');

  if (!authorization || !/Bearer\s+.+/.test(authorization)) return undefined;

  let [, token] = authorization.split(' ');

  if (!token) {
    token = request.cookies.token;
  }

  return token;
}

export function decodeToken(token: string | undefined | undefined) {
  if (!token) return null;

  try {
    const payload = JSON.parse(token) as { sub: number };
    const user = db.user.findFirst({
      where: { id: { equals: payload.sub } },
      strict: true,
    });

    return user;
  } catch {
    return null;
  }
}
