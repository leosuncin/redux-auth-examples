import { factory, nullable, oneOf, primaryKey } from '@mswjs/data';

function* generateAutoIncrement(): Generator<number, number> {
  let id = 1;

  while (true) {
    yield id++;
  }
}

const userSequence = generateAutoIncrement();
const taskSequence = generateAutoIncrement();

export type User = {
  id: number;
  name: string;
  email: string;
  password: string | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type Task = {
  id: number;
  text: string;
  done: boolean;
  owner: User;
  createdAt: Date;
  updatedAt: Date;
};

const db = factory({
  user: {
    id: primaryKey(() => userSequence.next().value),
    name: String,
    email: String,
    password: nullable(String),
    createdAt: () => new Date(),
    updatedAt: () => new Date(),
  },
  task: {
    id: primaryKey(() => taskSequence.next().value),
    text: String,
    done: (value?: boolean): boolean => value ?? false,
    owner: oneOf('user'),
    createdAt: () => new Date(),
    updatedAt: () => new Date(),
  },
});

export default db;
