import { faker } from '@faker-js/faker';

import type { CreateTask, UpdateTask } from '~/mocks/tasks';

export function buildCreateTask(overrides?: Partial<CreateTask>): CreateTask {
  return {
    text: faker.company.catchPhrase(),
    ...overrides,
  };
}

export function buildUpdateTask(overrides?: Partial<UpdateTask>): UpdateTask {
  return {
    ...faker.random.arrayElement([
      {
        text: faker.hacker.phrase(),
      },
      {
        done: faker.datatype.boolean(),
      },
      {
        text: faker.hacker.phrase(),
        done: faker.datatype.boolean(),
      },
    ]),
    ...overrides,
  };
}
