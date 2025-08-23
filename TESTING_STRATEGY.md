# **🧪 N8N-Work Testing Strategy & CI/CD Guide**

## **📋 Testing Strategy Overview**

### **Testing Pyramid**
- **Unit Tests (70%)**: Fast, isolated component tests
- **Integration Tests (20%)**: Database, API, and service interactions  
- **E2E Tests (10%)**: Complete user workflows

### **Key Testing Requirements**
- **Coverage**: 90%+ for services, 85%+ for controllers
- **Performance**: Tests must run under 10 minutes total
- **Reliability**: Zero flaky tests tolerated
- **Automation**: All tests in CI/CD pipeline

## **🔬 Unit Testing Setup**

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.{d.ts,interface.ts,module.ts}',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
```

**Example Service Test**:
```typescript
// credentials.service.spec.ts
describe('CredentialsService', () => {
  let service: CredentialsService;
  let mockRepository: jest.Mocked<Repository<Credential>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CredentialsService,
        { provide: getRepositoryToken(Credential), useValue: createMockRepository() },
        { provide: CredentialEncryptionService, useValue: createMockEncryption() },
      ],
    }).compile();

    service = module.get(CredentialsService);
    mockRepository = module.get(getRepositoryToken(Credential));
  });

  it('should create credential with encrypted data', async () => {
    const createDto = { name: 'Test', typeId: 'type-1', data: { key: 'value' } };
    mockRepository.save.mockResolvedValue({ id: 'cred-1', ...createDto });

    const result = await service.create(createDto, 'tenant-1', 'user-1');

    expect(result.id).toBe('cred-1');
    expect(mockRepository.save).toHaveBeenCalled();
  });
});
```

## **🔗 Integration Testing**

**Test Database Setup**:
```typescript
// test-setup.ts
export async function setupTestDB() {
  return Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: 'localhost',
        port: 5433,
        database: 'n8n_work_test',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: true,
        dropSchema: true,
      }),
    ],
  }).compile();
}
```

**API Integration Test**:
```typescript
describe('Credentials API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await setupTestDB();
    await app.init();
  });

  it('POST /credentials - should create credential', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/credentials')
      .set('Authorization', 'Bearer jwt-token')
      .send({ name: 'Test Cred', typeId: 'api-key', data: { key: 'secret' } })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.data).toBeUndefined(); // Sensitive data not returned
  });
});
```

## **🎭 E2E Testing**

**Complete Workflow Test**:
```typescript
describe('Workflow Execution E2E', () => {
  it('should execute workflow end-to-end', async () => {
    // 1. Create credential
    const credResponse = await request(app)
      .post('/api/v1/credentials')
      .send({ name: 'API Cred', typeId: 'http-auth', data: { token: 'secret' } });

    // 2. Create workflow
    const workflowResponse = await request(app)
      .post('/api/v1/workflows')
      .send({
        name: 'Test Workflow',
        nodes: [
          { id: 'trigger', type: 'ManualTrigger' },
          { id: 'http', type: 'HttpRequest', credentialId: credResponse.body.id }
        ]
      });

    // 3. Execute workflow
    const execResponse = await request(app)
      .post('/api/v1/executions')
      .send({ workflowId: workflowResponse.body.id });

    // 4. Verify execution completes
    await waitForExecution(execResponse.body.id, 'success');
  });
});
```

## **🔄 CI/CD Pipeline**

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: n8n_work_test
        ports: ['5432:5432']
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint & Format
        run: |
          npm run lint
          npm run format:check
      
      - name: Unit Tests
        run: npm run test:cov
      
      - name: Integration Tests
        run: npm run test:int
        env:
          DATABASE_URL: postgres://postgres:test_pass@localhost:5432/n8n_work_test
      
      - name: Build Docker Image
        run: docker build -t n8n-work/orchestrator .
      
      - name: E2E Tests
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run test:e2e
          docker-compose -f docker-compose.test.yml down

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Security Scan
        run: |
          npm audit --audit-level high
          docker run --rm -v "$PWD":/app clair-scanner
      
  deploy:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: kubectl apply -f k8s/
```

## **📊 Performance Testing**

```javascript
// k6-load-test.js
export let options = {
  stages: [
    { duration: '2m', target: 50 },  // Ramp up
    { duration: '5m', target: 100 }, // Load test
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  // Test workflow execution endpoint
  http.post('http://localhost:3000/api/v1/executions', {
    workflowId: 'test-workflow',
    mode: 'manual'
  });
  sleep(1);
}
```

## **🎯 Test Organization**

```
orchestrator-nest/
├── src/
│   ├── domains/
│   │   └── credentials/
│   │       ├── credentials.service.spec.ts     # Unit tests
│   │       └── credentials.integration.spec.ts # Integration tests
│   └── test/
│       ├── fixtures/         # Test data
│       ├── helpers/          # Test utilities
│       └── mocks/           # Mock implementations
├── e2e/
│   ├── auth.e2e-spec.ts
│   ├── workflows.e2e-spec.ts
│   └── webhooks.e2e-spec.ts
└── tests/
    ├── load/                # Performance tests
    └── security/            # Security tests
```

## **🚀 Testing Commands**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:int": "jest --config jest-integration.config.js",
    "test:e2e": "jest --config jest-e2e.config.js",
    "test:load": "k6 run tests/load/k6-load-test.js",
    "test:all": "npm run test:cov && npm run test:int && npm run test:e2e"
  }
}
```

## **✅ Quality Gates**

- **Code Coverage**: Minimum 90% for services
- **Performance**: API response time p95 < 500ms
- **Security**: Zero high/critical vulnerabilities
- **Reliability**: Test success rate > 99%
- **Documentation**: All APIs documented in Swagger

This testing strategy ensures comprehensive coverage while maintaining fast feedback loops and high confidence in deployments.