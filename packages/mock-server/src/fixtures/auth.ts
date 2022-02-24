import { faker } from '@faker-js/faker';

import type { Login, Register } from '~/mocks/auth';

export function buildRegister(overrides?: Partial<Register>): Register {
  return {
    name: faker.name.findName(),
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
    ...overrides,
  };
}

export function buildLogin(overrides?: Partial<Login>): Login {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
    ...overrides,
  };
}
