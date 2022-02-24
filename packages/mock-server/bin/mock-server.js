#!/bin/env node
/* eslint-disable unicorn/prefer-module */
const process = require('process');
const { createServer } = require('@mswjs/http-middleware');

const handlers = require('../dist/index.js');

function getPort() {
  const index = process.argv.indexOf('-p');

  return (
    Number(index === -1 ? process.env.PORT : process.argv[index + 1]) || 9090
  );
}

const httpServer = createServer(...Object.values(handlers));

httpServer.listen(getPort(), () => {
  console.log(`Mock server is listening at http://localhost:${getPort()}`);
});
