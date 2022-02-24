const baseConfig = require('../../.lintstagedrc.cjs');

module.exports = {
  ...baseConfig,
  '*.{js,cjs,mjs,ts}': ['xo --cache --fix'],
};
