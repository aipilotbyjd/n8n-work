import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';

// Test data factories
export class TestDataFactory {
  static createWorkflow(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      name: faker.commerce.productName(),
      description: faker.lorem.paragraph(),
      status: 'draft',
      nodes: [
        {
          id: 'start',
          type: 'trigger',
          name: 'HTTP Trigger',
          parameters: {},
          dependencies: [],
          position: { x: 100, y: 100 },
          policy: {
            timeoutSeconds: 30,
            retryCount: 3,
            retryStrategy: 'exponential',
            allowedDomains: ['*'],
            resourceLimits: {},
          },
        },
      ],
      edges: [],
      metadata: {
        tags: ['test'],
        environment: 'test',
      },
      tenantId: 'test-tenant',
      userId: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createExecution(workflowId: string, overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      workflowId,
      status: 'pending',
      context: { testData: faker.lorem.word() },
      triggerData: JSON.stringify({ source: 'manual', timestamp: Date.now() }),
      steps: [],
      startTime: new Date(),
      tenantId: 'test-tenant',
      userId: 'test-user',
      ...overrides,
    };
  }

  static createUser(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      name: faker.name.fullName(),
      tenantId: 'test-tenant',
      roles: ['user'],
      isActive: true,
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createTenant(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      name: faker.company.name(),
      domain: faker.internet.domainName(),
      quotas: {
        maxWorkflows: 100,
        maxExecutionsPerHour: 1000,
        maxNodesPerWorkflow: 50,
      },
      settings: {
        allowedDomains: ['*'],
        enableLogging: true,
        enableMetrics: true,
      },
      isActive: true,
      createdAt: new Date(),
      ...overrides,
    };
  }
}

// Authentication helpers
export class AuthHelper {
  static generateJwtToken(
    jwtService: JwtService,
    payload: {
      sub: string;
      tenantId: string;
      roles: string[];
      email?: string;
    },
    options: { expiresIn?: string } = {}
  ): string {
    return jwtService.sign(payload, { expiresIn: '1h', ...options });
  }

  static generateExpiredToken(jwtService: JwtService): string {
    return jwtService.sign(
      {
        sub: 'test-user',
        tenantId: 'test-tenant',
        roles: ['user'],
      },
      { expiresIn: '-1h' }
    );
  }

  static generateAdminToken(jwtService: JwtService): string {
    return this.generateJwtToken(jwtService, {
      sub: 'admin-user',
      tenantId: 'test-tenant',
      roles: ['admin'],
      email: 'admin@test.com',
    });
  }

  static generateUserToken(jwtService: JwtService): string {
    return this.generateJwtToken(jwtService, {
      sub: 'regular-user',
      tenantId: 'test-tenant',
      roles: ['user'],
      email: 'user@test.com',
    });
  }
}

// Database helpers
export class DatabaseHelper {
  static async cleanupDatabase(repositories: Repository<any>[]): Promise<void> {
    for (const repository of repositories) {
      await repository.clear();
    }
  }

  static async seedTestData(
    repository: Repository<any>,
    data: any[]
  ): Promise<any[]> {
    const entities = repository.create(data);
    return repository.save(entities);
  }

  static async createTestWorkflow(
    workflowRepository: Repository<any>,
    overrides: Partial<any> = {}
  ): Promise<any> {
    const workflow = TestDataFactory.createWorkflow(overrides);
    const entity = workflowRepository.create(workflow);
    return workflowRepository.save(entity);
  }
}

// HTTP request helpers
export class RequestHelper {
  static async makeAuthenticatedRequest(
    app: INestApplication,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    token: string,
    tenantId: string = 'test-tenant',
    body?: any
  ) {
    const request_instance = request(app.getHttpServer())[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantId);

    if (body) {
      request_instance.send(body);
    }

    return request_instance;
  }

  static async makeUnauthenticatedRequest(
    app: INestApplication,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    body?: any
  ) {
    const request_instance = request(app.getHttpServer())[method.toLowerCase()](url);

    if (body) {
      request_instance.send(body);
    }

    return request_instance;
  }

  static expectSuccessResponse(response: any, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus);
    if (expectedStatus !== 204) {
      expect(response.body).toBeDefined();
    }
  }

  static expectErrorResponse(
    response: any,
    expectedStatus: number,
    expectedMessage?: string
  ) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('timestamp');
    
    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  static expectPaginatedResponse(response: any, expectedTotal?: number) {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
    
    const pagination = response.body.pagination;
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('totalPages');
    
    if (expectedTotal !== undefined) {
      expect(pagination.total).toBe(expectedTotal);
    }
  }
}

// Test application helper
export class TestAppHelper {
  static async createTestApp(moduleClass: any): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [moduleClass],
    }).compile();

    const app = moduleFixture.createNestApplication();
    
    // Configure app like in main.ts
    // app.useGlobalPipes(new ValidationPipe());
    // app.useGlobalFilters(new AllExceptionsFilter());
    // app.useGlobalInterceptors(new LoggingInterceptor());
    
    await app.init();
    return app;
  }

  static async getService<T>(app: INestApplication, serviceClass: any): Promise<T> {
    return app.get<T>(serviceClass);
  }

  static async getRepository<T>(
    app: INestApplication,
    entityClass: any
  ): Promise<Repository<T>> {
    return app.get<Repository<T>>(getRepositoryToken(entityClass));
  }
}

// Mock data helpers
export class MockDataHelper {
  static createMockRepository<T = any>() {
    return {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ id: faker.datatype.uuid(), ...entity })),
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
      findOneBy: jest.fn(() => Promise.resolve(null)),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      clear: jest.fn(() => Promise.resolve()),
      count: jest.fn(() => Promise.resolve(0)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn(() => Promise.resolve([])),
        getOne: jest.fn(() => Promise.resolve(null)),
        getCount: jest.fn(() => Promise.resolve(0)),
        getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
      })),
    };
  }

  static createMockJwtService() {
    return {
      sign: jest.fn((payload, options) => 'mock-jwt-token'),
      verify: jest.fn((token) => ({ sub: 'test-user', tenantId: 'test-tenant' })),
      decode: jest.fn((token) => ({ sub: 'test-user', tenantId: 'test-tenant' })),
    };
  }

  static createMockRedisService() {
    return {
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve('OK')),
      del: jest.fn(() => Promise.resolve(1)),
      exists: jest.fn(() => Promise.resolve(0)),
      expire: jest.fn(() => Promise.resolve(1)),
      ttl: jest.fn(() => Promise.resolve(-1)),
      keys: jest.fn(() => Promise.resolve([])),
      flushdb: jest.fn(() => Promise.resolve('OK')),
    };
  }

  static createMockEventEmitter() {
    return {
      emit: jest.fn(() => true),
      on: jest.fn(() => this),
      once: jest.fn(() => this),
      removeListener: jest.fn(() => this),
      removeAllListeners: jest.fn(() => this),
      listenerCount: jest.fn(() => 0),
      listeners: jest.fn(() => []),
    };
  }
}

// Performance testing helpers
export class PerformanceHelper {
  static async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  }

  static expectExecutionTime(duration: number, maxTime: number) {
    expect(duration).toBeLessThan(maxTime);
  }

  static async runConcurrentRequests<T>(
    requests: (() => Promise<T>)[],
    maxConcurrency: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    const batches = [];
    
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      batches.push(requests.slice(i, i + maxConcurrency));
    }
    
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(request => request()));
      results.push(...batchResults);
    }
    
    return results;
  }
}

// Security testing helpers
export class SecurityTestHelper {
  static generateMaliciousPayloads() {
    return {
      xss: [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')" />',
      ],
      sqlInjection: [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
      ],
      pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '....//....//....//etc/passwd',
      ],
      commandInjection: [
        '; cat /etc/passwd',
        '| whoami',
        '&& ls -la',
      ],
    };
  }

  static createLargePayload(sizeInMB: number = 10): string {
    return 'A'.repeat(sizeInMB * 1024 * 1024);
  }

  static async testRateLimit(
    makeRequest: () => Promise<any>,
    requestCount: number = 100
  ): Promise<{ rateLimitedCount: number; totalRequests: number }> {
    const requests = Array.from({ length: requestCount }, makeRequest);
    const responses = await Promise.allSettled(requests);
    
    const rateLimitedCount = responses.filter(
      (response) =>
        response.status === 'fulfilled' && response.value.status === 429
    ).length;
    
    return { rateLimitedCount, totalRequests: requestCount };
  }
}

// Environment helpers
export class EnvironmentHelper {
  static setTestEnvironmentVariables() {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
  }

  static cleanupTestEnvironmentVariables() {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_KEY;
  }

  static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

// Validation helpers
export class ValidationHelper {
  static expectValidUUID(value: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(value)).toBe(true);
  }

  static expectValidTimestamp(value: string | Date) {
    const date = new Date(value);
    expect(date instanceof Date && !isNaN(date.getTime())).toBe(true);
  }

  static expectValidWorkflowStructure(workflow: any) {
    expect(workflow).toHaveProperty('id');
    expect(workflow).toHaveProperty('name');
    expect(workflow).toHaveProperty('nodes');
    expect(workflow).toHaveProperty('edges');
    expect(workflow).toHaveProperty('status');
    expect(workflow).toHaveProperty('tenantId');
    expect(workflow).toHaveProperty('userId');
    expect(Array.isArray(workflow.nodes)).toBe(true);
    expect(Array.isArray(workflow.edges)).toBe(true);
    this.expectValidUUID(workflow.id);
    this.expectValidUUID(workflow.tenantId);
    this.expectValidUUID(workflow.userId);
  }
}
