module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/?(*.)(spec|test).{js,jsx,ts,tsx}',
  ],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'orchestrator-nest/src/**/*.{ts,js}',
    'engine-go/**/*.go',
    'node-runner-js/src/**/*.{ts,js}',
    'node-sdk-js/src/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/*.config.{ts,js}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    '!**/*.spec.{ts,js}',
    '!**/*.test.{ts,js}',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Service-specific thresholds
    'orchestrator-nest/src/workflows/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'orchestrator-nest/src/security/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'cobertura',
    'json',
  ],
  
  // Test directories
  roots: [
    '<rootDir>/tests',
    '<rootDir>/orchestrator-nest',
    '<rootDir>/node-runner-js',
    '<rootDir>/node-sdk-js',
  ],
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/orchestrator-nest/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      diagnostics: {
        warnOnly: true,
      },
    },
  },
  
  // Test environments for different types of tests
  projects: [
    // Unit tests
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/**/*.unit.spec.{js,ts}'],
      testEnvironment: 'node',
    },
    
    // Integration tests
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/**/*.integration.spec.{js,ts}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts'],
    },
    
    // E2E tests
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/**/*.e2e-spec.{js,ts}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.setup.ts'],
      testTimeout: 60000,
    },
    
    // Security tests
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.spec.{js,ts}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/security.setup.ts'],
      testTimeout: 120000,
    },
  ],
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'test-report.html',
        expand: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/junit',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
    [
      'jest-sonar-reporter',
      {
        outputDirectory: './coverage/sonar',
        outputName: 'test-execution-report.xml',
      },
    ],
  ],
  
  // Watch options
  watchman: true,
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  
  // Clear mocks
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  
  // Error handling
  bail: 0, // Continue running tests after failures
  verbose: true,
  
  // Parallel execution
  maxWorkers: '50%',
  
  // Cache
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/(?!(module-to-transform)/)',
  ],
};
