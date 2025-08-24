import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import ora from 'ora';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  input: any;
  expectedOutput?: any;
  expectedError?: string;
  timeout?: number;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  skip?: boolean;
  only?: boolean;
  tags?: string[];
}

export interface TestResult {
  testId: string;
  passed: boolean;
  duration: number;
  output?: any;
  error?: string;
  timestamp: string;
  memory?: number;
  coverage?: CoverageInfo;
}

export interface CoverageInfo {
  lines: { total: number; covered: number };
  functions: { total: number; covered: number };
  branches: { total: number; covered: number };
  statements: { total: number; covered: number };
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}

export interface TestConfig {
  parallel: boolean;
  maxWorkers: number;
  timeout: number;
  retries: number;
  coverage: boolean;
  verbose: boolean;
  bail: boolean;
  grep?: RegExp;
  tags?: string[];
}

export class TestFramework extends EventEmitter {
  private config: TestConfig;
  private suites: Map<string, TestSuite> = new Map();
  private results: Map<string, TestResult> = new Map();
  private running = false;

  constructor(config: Partial<TestConfig> = {}) {
    super();
    this.config = {
      parallel: true,
      maxWorkers: 4,
      timeout: 30000,
      retries: 0,
      coverage: false,
      verbose: false,
      bail: false,
      ...config
    };
  }

  addSuite(suite: TestSuite): void {
    this.suites.set(suite.name, suite);
  }

  async runTests(): Promise<TestRunSummary> {
    if (this.running) {
      throw new Error('Tests are already running');
    }

    this.running = true;
    const startTime = performance.now();
    const spinner = ora('Running tests...').start();

    try {
      const summary: TestRunSummary = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        suites: [],
        coverage: undefined
      };

      // Filter and prepare tests
      const testCases = this.prepareTestCases();
      summary.total = testCases.length;

      if (testCases.length === 0) {
        spinner.info('No tests to run');
        return summary;
      }

      spinner.text = `Running ${testCases.length} tests...`;

      // Run tests
      if (this.config.parallel && testCases.length > 1) {
        await this.runTestsParallel(testCases, summary);
      } else {
        await this.runTestsSequential(testCases, summary);
      }

      // Generate coverage if enabled
      if (this.config.coverage) {
        summary.coverage = await this.generateCoverageReport();
      }

      summary.duration = performance.now() - startTime;

      // Display results
      this.displayResults(summary, spinner);

      return summary;
    } finally {
      this.running = false;
    }
  }

  private prepareTestCases(): TestCase[] {
    const allTests: TestCase[] = [];

    for (const suite of this.suites.values()) {
      for (const test of suite.tests) {
        // Apply filters
        if (test.skip) continue;
        if (this.config.grep && !this.config.grep.test(test.name)) continue;
        if (this.config.tags && !test.tags?.some(tag => this.config.tags!.includes(tag))) continue;

        allTests.push(test);
      }
    }

    // If any test has 'only', run only those
    const onlyTests = allTests.filter(test => test.only);
    return onlyTests.length > 0 ? onlyTests : allTests;
  }

  private async runTestsSequential(tests: TestCase[], summary: TestRunSummary): Promise<void> {
    for (const test of tests) {
      if (this.config.bail && summary.failed > 0) {
        break;
      }

      const result = await this.runSingleTest(test);
      this.updateSummary(summary, result);
      
      if (this.config.verbose) {
        this.logTestResult(result);
      }
    }
  }

  private async runTestsParallel(tests: TestCase[], summary: TestRunSummary): Promise<void> {
    const chunks = this.chunkArray(tests, this.config.maxWorkers);
    
    for (const chunk of chunks) {
      if (this.config.bail && summary.failed > 0) {
        break;
      }

      const promises = chunk.map(test => this.runSingleTest(test));
      const results = await Promise.all(promises);
      
      for (const result of results) {
        this.updateSummary(summary, result);
        
        if (this.config.verbose) {
          this.logTestResult(result);
        }
        
        if (this.config.bail && !result.passed) {
          return;
        }
      }
    }
  }

  private async runSingleTest(test: TestCase): Promise<TestResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Setup
      if (test.setup) {
        await test.setup();
      }

      // Find suite for hooks
      const suite = this.findSuiteForTest(test);
      if (suite?.beforeEach) {
        await suite.beforeEach();
      }

      // Run test with timeout
      const timeout = test.timeout || this.config.timeout;
      const result = await this.executeTestWithTimeout(test, timeout);

      // Teardown
      if (suite?.afterEach) {
        await suite.afterEach();
      }

      if (test.teardown) {
        await test.teardown();
      }

      const duration = performance.now() - startTime;
      const memory = process.memoryUsage().heapUsed - startMemory;

      const testResult: TestResult = {
        testId: test.id,
        passed: this.validateTestResult(test, result),
        duration,
        output: result,
        timestamp: new Date().toISOString(),
        memory
      };

      this.results.set(test.id, testResult);
      this.emit('testComplete', testResult);

      return testResult;
    } catch (error) {
      const duration = performance.now() - startTime;
      const memory = process.memoryUsage().heapUsed - startMemory;

      const testResult: TestResult = {
        testId: test.id,
        passed: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
        memory
      };

      this.results.set(test.id, testResult);
      this.emit('testComplete', testResult);

      return testResult;
    }
  }

  private async executeTestWithTimeout(test: TestCase, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);

      this.executeTest(test)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeTest(test: TestCase): Promise<any> {
    // This would integrate with the actual node execution
    // For now, simulate test execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Mock execution result
    return {
      success: true,
      output: { message: `Test ${test.name} executed` },
      executionTime: 50
    };
  }

  private validateTestResult(test: TestCase, result: any): boolean {
    // If expected error, check if error occurred
    if (test.expectedError) {
      return result.error !== undefined;
    }

    // If expected output, compare with actual
    if (test.expectedOutput) {
      return JSON.stringify(result.output) === JSON.stringify(test.expectedOutput);
    }

    // Default: check if execution was successful
    return result.success === true;
  }

  private findSuiteForTest(test: TestCase): TestSuite | undefined {
    for (const suite of this.suites.values()) {
      if (suite.tests.some(t => t.id === test.id)) {
        return suite;
      }
    }
    return undefined;
  }

  private updateSummary(summary: TestRunSummary, result: TestResult): void {
    if (result.passed) {
      summary.passed++;
    } else {
      summary.failed++;
    }
  }

  private async generateCoverageReport(): Promise<CoverageInfo> {
    // Mock coverage report
    return {
      lines: { total: 100, covered: 85 },
      functions: { total: 20, covered: 18 },
      branches: { total: 40, covered: 32 },
      statements: { total: 120, covered: 102 }
    };
  }

  private displayResults(summary: TestRunSummary, spinner: ora.Ora): void {
    const { total, passed, failed, skipped, duration } = summary;
    
    if (failed > 0) {
      spinner.fail(`Tests completed: ${failed} failed`);
    } else {
      spinner.succeed(`All tests passed!`);
    }

    console.log('\n' + chalk.bold('Test Results:'));
    console.log(`  Total: ${total}`);
    console.log(`  ${chalk.green('Passed')}: ${passed}`);
    if (failed > 0) console.log(`  ${chalk.red('Failed')}: ${failed}`);
    if (skipped > 0) console.log(`  ${chalk.yellow('Skipped')}: ${skipped}`);
    console.log(`  Duration: ${Math.round(duration)}ms`);

    if (summary.coverage) {
      console.log('\n' + chalk.bold('Coverage:'));
      const { lines, functions, branches, statements } = summary.coverage;
      console.log(`  Lines: ${Math.round(lines.covered/lines.total*100)}% (${lines.covered}/${lines.total})`);
      console.log(`  Functions: ${Math.round(functions.covered/functions.total*100)}% (${functions.covered}/${functions.total})`);
      console.log(`  Branches: ${Math.round(branches.covered/branches.total*100)}% (${branches.covered}/${branches.total})`);
      console.log(`  Statements: ${Math.round(statements.covered/statements.total*100)}% (${statements.covered}/${statements.total})`);
    }

    // Show failed tests
    if (failed > 0) {
      console.log('\n' + chalk.bold.red('Failed Tests:'));
      for (const [testId, result] of this.results) {
        if (!result.passed) {
          console.log(`  ${chalk.red('✗')} ${testId}: ${result.error}`);
        }
      }
    }
  }

  private logTestResult(result: TestResult): void {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    const duration = chalk.gray(`(${Math.round(result.duration)}ms)`);
    console.log(`    ${icon} ${result.testId} ${duration}`);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Utility methods for building test suites
  static describe(name: string, description: string, fn: (suite: TestSuiteBuilder) => void): TestSuite {
    const builder = new TestSuiteBuilder(name, description);
    fn(builder);
    return builder.build();
  }
}

export class TestSuiteBuilder {
  private suite: TestSuite;

  constructor(name: string, description: string) {
    this.suite = {
      name,
      description,
      tests: []
    };
  }

  beforeAll(fn: () => Promise<void>): this {
    this.suite.beforeAll = fn;
    return this;
  }

  afterAll(fn: () => Promise<void>): this {
    this.suite.afterAll = fn;
    return this;
  }

  beforeEach(fn: () => Promise<void>): this {
    this.suite.beforeEach = fn;
    return this;
  }

  afterEach(fn: () => Promise<void>): this {
    this.suite.afterEach = fn;
    return this;
  }

  it(name: string, test: Omit<TestCase, 'id' | 'name'>): this {
    const testCase: TestCase = {
      id: `${this.suite.name}_${name}`.replace(/\s+/g, '_'),
      name,
      ...test
    };
    this.suite.tests.push(testCase);
    return this;
  }

  build(): TestSuite {
    return this.suite;
  }
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  suites: string[];
  coverage?: CoverageInfo;
}

// CLI command implementation
export async function runTests(pattern: string, options: any): Promise<void> {
  const config: Partial<TestConfig> = {
    parallel: !options.serial,
    maxWorkers: options.workers || 4,
    timeout: options.timeout || 30000,
    retries: options.retries || 0,
    coverage: options.coverage,
    verbose: options.verbose,
    bail: options.bail,
    grep: options.grep ? new RegExp(options.grep) : undefined,
    tags: options.tags ? options.tags.split(',') : undefined
  };

  const framework = new TestFramework(config);
  
  // Load test files based on pattern
  // This would scan for test files and load them
  console.log(chalk.blue('Loading test files...'));
  
  try {
    const summary = await framework.runTests();
    
    // Exit with error code if tests failed
    if (summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Test execution failed:'), error.message);
    process.exit(1);
  }
}