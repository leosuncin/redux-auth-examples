const baseConfig = require('../../.lintstagedrc.cjs');

module.exports = {
  ...baseConfig,
  '*.{js,jsx,ts,tsx}': ['eslint --cache --fix', 'prettier --write'],
};
