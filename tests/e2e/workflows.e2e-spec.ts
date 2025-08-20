import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { WorkflowsController } from '../../../src/workflows/workflows.controller';
import { WorkflowsService } from '../../../src/workflows/workflows.service';
import { Workflow } from '../../../src/workflows/entities/workflow.entity';
import { ExecutionsService } from '../../../src/executions/executions.service';
import { SecurityService } from '../../../src/security/security.service';

describe('WorkflowsController (e2e)', () => {
  let app: INestApplication;
  let workflowRepository: Repository<Workflow>;
  let jwtService: JwtService;
  let authToken: string;

  const mockWorkflow = {
    name: 'Test Workflow',
    description: 'E2E test workflow',
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
      tags: ['e2e-test'],
      environment: 'test',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Import your actual modules here
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Setup global pipes, filters, interceptors like in main.ts
    // app.useGlobalPipes(new ValidationPipe());
    
    await app.init();

    workflowRepository = moduleFixture.get<Repository<Workflow>>(
      getRepositoryToken(Workflow),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Generate auth token for tests
    authToken = jwtService.sign(
      {
        sub: 'test-user-id',
        tenantId: 'test-tenant',
        roles: ['admin'],
      },
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await workflowRepository.delete({});
    await app.close();
  });

  afterEach(async () => {
    // Clean up after each test
    await workflowRepository.delete({});
  });

  describe('/workflows (POST)', () => {
    it('should create a workflow', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(mockWorkflow)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(mockWorkflow.name);
      expect(response.body.status).toBe('draft');
      expect(response.body.nodes).toHaveLength(1);
    });

    it('should validate workflow schema', async () => {
      const invalidWorkflow = { ...mockWorkflow };
      delete invalidWorkflow.name;

      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(invalidWorkflow)
        .expect(400);
    });

    it('should enforce tenant isolation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'different-tenant')
        .send(mockWorkflow)
        .expect(403);
    });
  });

  describe('/workflows (GET)', () => {
    beforeEach(async () => {
      // Create test workflows
      const workflow1 = workflowRepository.create({
        ...mockWorkflow,
        name: 'Test Workflow 1',
        tenantId: 'test-tenant',
        userId: 'test-user-id',
      });
      const workflow2 = workflowRepository.create({
        ...mockWorkflow,
        name: 'Test Workflow 2',
        tenantId: 'test-tenant',
        userId: 'test-user-id',
      });
      
      await workflowRepository.save([workflow1, workflow2]);
    });

    it('should list workflows with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/workflows?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter workflows by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/workflows?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(workflow => {
        expect(workflow.status).toBe('draft');
      });
    });

    it('should search workflows by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/workflows?search=Workflow 1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Workflow 1');
    });
  });

  describe('/workflows/:id (GET)', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = workflowRepository.create({
        ...mockWorkflow,
        tenantId: 'test-tenant',
        userId: 'test-user-id',
      });
      const savedWorkflow = await workflowRepository.save(workflow);
      workflowId = savedWorkflow.id;
    });

    it('should get workflow by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      expect(response.body.id).toBe(workflowId);
      expect(response.body.name).toBe(mockWorkflow.name);
    });

    it('should return 404 for non-existent workflow', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(404);
    });

    it('should enforce tenant isolation for get', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'different-tenant')
        .expect(403);
    });
  });

  describe('/workflows/:id (PUT)', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = workflowRepository.create({
        ...mockWorkflow,
        tenantId: 'test-tenant',
        userId: 'test-user-id',
      });
      const savedWorkflow = await workflowRepository.save(workflow);
      workflowId = savedWorkflow.id;
    });

    it('should update workflow', async () => {
      const updatedData = {
        name: 'Updated Workflow Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(updatedData)
        .expect(200);

      expect(response.body.name).toBe(updatedData.name);
      expect(response.body.description).toBe(updatedData.description);
    });

    it('should validate update data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      await request(app.getHttpServer())
        .put(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('/workflows/:id (DELETE)', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = workflowRepository.create({
        ...mockWorkflow,
        tenantId: 'test-tenant',
        userId: 'test-user-id',
      });
      const savedWorkflow = await workflowRepository.save(workflow);
      workflowId = savedWorkflow.id;
    });

    it('should delete workflow', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(204);

      // Verify deletion
      const deletedWorkflow = await workflowRepository.findOne({
        where: { id: workflowId },
      });
      expect(deletedWorkflow).toBeNull();
    });

    it('should return 404 when deleting non-existent workflow', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(404);
    });
  });

  describe('/workflows/:id/activate (POST)', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = workflowRepository.create({
        ...mockWorkflow,
        tenantId: 'test-tenant',
        userId: 'test-user-id',
        status: 'draft',
      });
      const savedWorkflow = await workflowRepository.save(workflow);
      workflowId = savedWorkflow.id;
    });

    it('should activate workflow', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should not activate already active workflow', async () => {
      // First activation
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);

      // Second activation should return conflict
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(409);
    });
  });

  describe('/workflows/:id/execute (POST)', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = workflowRepository.create({
        ...mockWorkflow,
        tenantId: 'test-tenant',
        userId: 'test-user-id',
        status: 'active',
      });
      const savedWorkflow = await workflowRepository.save(workflow);
      workflowId = savedWorkflow.id;
    });

    it('should execute workflow', async () => {
      const executionData = {
        context: { testData: 'test-value' },
        triggerData: JSON.stringify({ source: 'manual' }),
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(executionData)
        .expect(200);

      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('status');
    });

    it('should not execute inactive workflow', async () => {
      // Deactivate workflow
      await workflowRepository.update(workflowId, { status: 'draft' });

      const executionData = {
        context: { testData: 'test-value' },
        triggerData: JSON.stringify({ source: 'manual' }),
      };

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send(executionData)
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array.from({ length: 101 }, (_, i) => 
        request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Tenant-ID', 'test-tenant')
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        response => response.status === 'fulfilled' && 
        response.value.status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .expect(401);
    });

    it('should reject requests with invalid auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests without tenant ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should enforce role-based access', async () => {
      const userToken = jwtService.sign(
        {
          sub: 'user-id',
          tenantId: 'test-tenant',
          roles: ['user'], // Non-admin role
        },
        { expiresIn: '1h' },
      );

      // Admin-only endpoint
      await request(app.getHttpServer())
        .delete(`/api/v1/workflows/some-id`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(403);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection
      // Implementation depends on your error handling strategy
    });

    it('should return proper error format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .send({}) // Invalid data
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', 'test-tenant')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // 500ms threshold
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Tenant-ID', 'test-tenant')
      );

      const responses = await Promise.all(concurrentRequests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
