module.exports = {
  extensions: {
    ts: 'commonjs',
  },
  failWithoutAssertions: false,
  nodeArguments: ['--require=esbuild-register'],
  environmentVariables: {
    NODE_ENV: 'test',
  },
};
