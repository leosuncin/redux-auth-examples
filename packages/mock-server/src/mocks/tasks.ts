import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { rest } from 'msw';

import db from '~/db';
import {
  decodeToken,
  delayedResponse,
  extractTokenFromRequest,
  unauthorizedResponse,
  type ApiError,
} from '~/utils';

export type Task = {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateTask = {
  text: string;
};

export type UpdateTask = {
  text?: string;
  done?: boolean;
};

type IdParameter = {
  id: string;
};

export const createTaskHandler = rest.post<CreateTask>(
  '*/tasks',
  (request, response, context) => {
    const { text } = request.body;
    const owner = decodeToken(extractTokenFromRequest(request));

    if (!owner) return unauthorizedResponse();

    const errors: Record<keyof CreateTask, string[]> = {
      text: [],
    };

    if (typeof text !== 'string') {
      errors.text.push('The text must be a string');
    } else if (text.length === 0 || text.trim().length === 0) {
      errors.text.push('The text should not be empty');
    }

    if (errors.text.length > 0) {
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

    const task = db.task.create({ text: text.trim(), owner });

    return delayedResponse(
      context.status(StatusCodes.CREATED),
      context.json(task),
    );
  },
);

export const listTaskHandler = rest.get(
  '*/tasks',
  (request, _response, context) => {
    const owner = decodeToken(extractTokenFromRequest(request));

    if (!owner) return unauthorizedResponse();

    const tasks = db.task.findMany({
      where: { owner: { id: { equals: Number(owner.id) } } },
    });

    return delayedResponse(context.json(tasks));
  },
);

export const updateTaskHandler = rest.put<UpdateTask, IdParameter>(
  '*/tasks/:id',
  (request, response, context) => {
    const { done, text } = request.body;
    const { id } = request.params;
    const owner = decodeToken(extractTokenFromRequest(request));

    if (!owner) return unauthorizedResponse();

    const errors: Partial<Record<keyof UpdateTask, string[]>> = {};

    if ('text' in request.body && typeof text !== 'string') {
      errors.text = ['The text must be a string'];
    } else if (
      typeof text === 'string' &&
      (text.length === 0 || text.trim().length === 0)
    ) {
      errors.text = ['The text should not be empty'];
    }

    if ('done' in request.body && typeof done !== 'boolean') {
      errors.done = ['The `done` must be a boolean'];
    }

    if (Object.entries(request.body).length === 0) {
      errors.text = ['The text must be a string'];
      errors.done = ['The `done` must be a boolean'];
    }

    if (Array.isArray(errors.done) || Array.isArray(errors.text)) {
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

    let task = db.task.findFirst({ where: { id: { equals: Number(id) } } });

    if (!task) {
      return response(
        context.status(StatusCodes.NOT_FOUND),
        context.json<ApiError>({
          statusCode: StatusCodes.NOT_FOUND,
          error: ReasonPhrases.NOT_FOUND,
          message: `Not found any task with id: ${id}`,
        }),
      );
    }

    task = db.task.update({
      data: {
        done: done ?? task.done,
        text: text ?? task.text,
        updatedAt: new Date(),
      },
      where: { id: { equals: Number(id) } },
    });

    return delayedResponse(
      context.json({
        ...task,
        owner: owner.id,
      }),
    );
  },
);

export const removeTaskHandler = rest.delete<UpdateTask, IdParameter>(
  '*/tasks/:id',
  (request, response, context) => {
    const { id } = request.params;
    const owner = decodeToken(extractTokenFromRequest(request));

    if (!owner) return unauthorizedResponse();

    try {
      db.task.delete({
        where: { id: { equals: Number(id) } },
        strict: true,
      });

      return delayedResponse(context.status(StatusCodes.NO_CONTENT));
    } catch {
      return response(
        context.status(StatusCodes.NOT_FOUND),
        context.json<ApiError>({
          statusCode: StatusCodes.NOT_FOUND,
          error: ReasonPhrases.NOT_FOUND,
          message: `Not found any task with id: ${id}`,
        }),
      );
    }
  },
);
