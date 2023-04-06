const config = () => {
  const confObject = {
    testEnvironment: 'jsdom',
    testRunner: 'jest-jasmine2',
    setupFilesAfterEnv: [],
    transform: {
      '^.+\\.(js|jsx|mjs|cjs)$': [
        '@swc/jest',
        {
          jsc: {
            parser: {
              syntax: 'ecmascript',
              jsx: true
            },
            transform: {
              react: {
                runtime: 'automatic'
              }
            }
          }
        }
      ],
      '^.+\\.(ts|tsx)$': [
        '@swc/jest',
        {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true
            },
            transform: {
              react: {
                runtime: 'automatic'
              }
            }
          }
        }
      ]
    },
    transformIgnorePatterns: [
      'node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$'
    ],
    moduleNameMapper: {
      '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy'
    }
  };

  if (process.env.CI === 'true') {
    config.maxWorkers = 4;
  }

  return confObject;
};

module.exports = config;
