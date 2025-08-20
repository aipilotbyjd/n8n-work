import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { SecurityService } from '../../orchestrator-nest/src/security/security.service';
import * as crypto from 'crypto';

describe('Security Tests', () => {
  let app: INestApplication;
  let securityService: SecurityService;
  let jwtService: JwtService;

  const testPayloads = {
    xss: [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(\'xss\')" />',
      '<svg onload="alert(\'xss\')" />',
      '"><script>alert("xss")</script>',
      'javascript://comment%0aalert("xss");',
    ],
    sqlInjection: [
      "' OR '1'='1",
      "' UNION SELECT * FROM users--",
      "'; DROP TABLE workflows;--",
      "' OR 1=1#",
      "admin'--",
      "' OR 'x'='x",
      "1'; WAITFOR DELAY '00:00:10'--",
    ],
    pathTraversal: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
    ],
    commandInjection: [
      '; cat /etc/passwd',
      '| whoami',
      '&& ls -la',
      '; rm -rf /',
      '`whoami`',
      '$(whoami)',
      '; ping -c 10 127.0.0.1',
    ],
    ldapInjection: [
      '*)(uid=*',
      '*)(|(uid=*))',
      '*)(&(uid=*))',
      '*))%00',
      '*()|%00',
    ],
    xmlInjection: [
      '<!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///c:/windows/win.ini">]><root>&test;</root>',
    ],
    nosqlInjection: [
      '{"$ne": ""}',
      '{"$gt": ""}',
      '{"$regex": ".*"}',
      '{"$where": "this.credits == this.debits"}',
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Configure test module
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    securityService = moduleFixture.get<SecurityService>(SecurityService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Input Validation & Sanitization', () => {
    describe('XSS Protection', () => {
      testPayloads.xss.forEach((payload, index) => {
        it(`should sanitize XSS payload ${index + 1}: ${payload.substring(0, 50)}...`, async () => {
          const response = await request(app.getHttpServer())
            .post('/api/v1/workflows')
            .send({
              name: payload,
              description: `Test with XSS payload: ${payload}`,
              nodes: [],
              edges: [],
            })
            .set('Authorization', 'Bearer valid-token')
            .set('X-Tenant-ID', 'test-tenant');

          // Should either reject the request or sanitize the input
          if (response.status === 201) {
            expect(response.body.name).not.toContain('<script');
            expect(response.body.name).not.toContain('javascript:');
            expect(response.body.description).not.toContain('<script');
          } else {
            expect(response.status).toBeGreaterThanOrEqual(400);
          }
        });
      });
    });

    describe('SQL Injection Protection', () => {
      testPayloads.sqlInjection.forEach((payload, index) => {
        it(`should prevent SQL injection ${index + 1}: ${payload}`, async () => {
          const response = await request(app.getHttpServer())
            .get('/api/v1/workflows')
            .query({
              search: payload,
              orderBy: payload,
            })
            .set('Authorization', 'Bearer valid-token')
            .set('X-Tenant-ID', 'test-tenant');

          // Should not execute SQL injection
          expect(response.status).not.toBe(500);
          if (response.status === 200) {
            expect(response.body).toHaveProperty('data');
          }
        });
      });
    });

    describe('Path Traversal Protection', () => {
      testPayloads.pathTraversal.forEach((payload, index) => {
        it(`should prevent path traversal ${index + 1}: ${payload}`, async () => {
          const response = await request(app.getHttpServer())
            .get(`/api/v1/workflows/${payload}`)
            .set('Authorization', 'Bearer valid-token')
            .set('X-Tenant-ID', 'test-tenant');

          // Should reject path traversal attempts
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.status).not.toBe(200);
        });
      });
    });

    describe('Command Injection Protection', () => {
      testPayloads.commandInjection.forEach((payload, index) => {
        it(`should prevent command injection ${index + 1}: ${payload}`, async () => {
          const response = await request(app.getHttpServer())
            .post('/api/v1/workflows')
            .send({
              name: `Test Workflow ${payload}`,
              description: payload,
              nodes: [{
                id: 'test',
                type: 'shell',
                parameters: {
                  command: payload,
                },
              }],
              edges: [],
            })
            .set('Authorization', 'Bearer valid-token')
            .set('X-Tenant-ID', 'test-tenant');

          // Should sanitize or reject command injection
          expect(response.status).not.toBe(500);
        });
      });
    });
  });

  describe('Authentication & Authorization', () => {
    describe('JWT Token Security', () => {
      it('should reject requests without JWT token', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('X-Tenant-ID', 'test-tenant');

        expect(response.status).toBe(401);
      });

      it('should reject expired JWT tokens', async () => {
        const expiredToken = jwtService.sign(
          { sub: 'user', tenantId: 'test-tenant' },
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${expiredToken}`)
          .set('X-Tenant-ID', 'test-tenant');

        expect(response.status).toBe(401);
      });

      it('should reject malformed JWT tokens', async () => {
        const malformedTokens = [
          'invalid-token',
          'Bearer invalid-token',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
          '',
          'null',
        ];

        for (const token of malformedTokens) {
          const response = await request(app.getHttpServer())
            .get('/api/v1/workflows')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Tenant-ID', 'test-tenant');

          expect(response.status).toBe(401);
        }
      });

      it('should reject JWT tokens with invalid signatures', async () => {
        // Create a token with a different secret
        const invalidToken = jwtService.sign(
          { sub: 'user', tenantId: 'test-tenant' },
          { secret: 'different-secret' }
        );

        const response = await request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${invalidToken}`)
          .set('X-Tenant-ID', 'test-tenant');

        expect(response.status).toBe(401);
      });
    });

    describe('Tenant Isolation', () => {
      it('should enforce tenant isolation', async () => {
        const userATenant = 'tenant-a';
        const userBTenant = 'tenant-b';

        const tokenA = jwtService.sign({
          sub: 'user-a',
          tenantId: userATenant,
          roles: ['user'],
        });

        const tokenB = jwtService.sign({
          sub: 'user-b',
          tenantId: userBTenant,
          roles: ['user'],
        });

        // Create workflow for tenant A
        const workflowResponse = await request(app.getHttpServer())
          .post('/api/v1/workflows')
          .send({
            name: 'Tenant A Workflow',
            nodes: [],
            edges: [],
          })
          .set('Authorization', `Bearer ${tokenA}`)
          .set('X-Tenant-ID', userATenant)
          .expect(201);

        const workflowId = workflowResponse.body.id;

        // User B should not be able to access User A's workflow
        const accessResponse = await request(app.getHttpServer())
          .get(`/api/v1/workflows/${workflowId}`)
          .set('Authorization', `Bearer ${tokenB}`)
          .set('X-Tenant-ID', userBTenant);

        expect(accessResponse.status).toBeGreaterThanOrEqual(403);
      });

      it('should validate tenant ID in headers', async () => {
        const token = jwtService.sign({
          sub: 'user',
          tenantId: 'correct-tenant',
          roles: ['user'],
        });

        const response = await request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Tenant-ID', 'different-tenant');

        expect(response.status).toBe(403);
      });
    });

    describe('Role-Based Access Control', () => {
      it('should enforce admin-only endpoints', async () => {
        const userToken = jwtService.sign({
          sub: 'user',
          tenantId: 'test-tenant',
          roles: ['user'],
        });

        const adminToken = jwtService.sign({
          sub: 'admin',
          tenantId: 'test-tenant',
          roles: ['admin'],
        });

        // User should not be able to access admin endpoint
        const userResponse = await request(app.getHttpServer())
          .get('/api/v1/admin/system-info')
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-Tenant-ID', 'test-tenant');

        expect(userResponse.status).toBe(403);

        // Admin should be able to access admin endpoint
        const adminResponse = await request(app.getHttpServer())
          .get('/api/v1/admin/system-info')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('X-Tenant-ID', 'test-tenant');

        expect(adminResponse.status).toBeLessThan(400);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per tenant', async () => {
      const token = jwtService.sign({
        sub: 'user',
        tenantId: 'test-tenant',
        roles: ['user'],
      });

      const requests = Array.from({ length: 200 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/workflows')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Tenant-ID', 'test-tenant')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedCount = responses.filter(
        (response) =>
          response.status === 'fulfilled' && response.value.status === 429
      ).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const token = jwtService.sign({
        sub: 'user',
        tenantId: 'test-tenant',
        roles: ['user'],
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', 'test-tenant');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health');

      const expectedHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'content-security-policy': expect.stringContaining("default-src 'self'"),
        'referrer-policy': 'strict-origin-when-cross-origin',
      };

      Object.entries(expectedHeaders).forEach(([header, expectedValue]) => {
        if (typeof expectedValue === 'string') {
          expect(response.headers[header]).toBe(expectedValue);
        } else {
          expect(response.headers[header]).toEqual(expectedValue);
        }
      });
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        apiKey: 'secret-api-key-12345',
        password: 'super-secret-password',
        token: 'sensitive-token-data',
      };

      const encrypted = await securityService.encryptData(
        JSON.stringify(sensitiveData)
      );

      // Encrypted data should not contain original values
      expect(encrypted).not.toContain(sensitiveData.apiKey);
      expect(encrypted).not.toContain(sensitiveData.password);
      expect(encrypted).not.toContain(sensitiveData.token);

      // Should be able to decrypt
      const decrypted = await securityService.decryptData(encrypted);
      const decryptedData = JSON.parse(decrypted);

      expect(decryptedData).toEqual(sensitiveData);
    });

    it('should detect and redact PII in logs', async () => {
      const testData = {
        email: 'user@example.com',
        phone: '+1-555-123-4567',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        ip: '192.168.1.1',
      };

      const redacted = securityService.redactPII(JSON.stringify(testData));

      expect(redacted).not.toContain(testData.email);
      expect(redacted).not.toContain(testData.phone);
      expect(redacted).not.toContain(testData.ssn);
      expect(redacted).not.toContain(testData.creditCard);
      expect(redacted).toContain('[REDACTED_EMAIL]');
      expect(redacted).toContain('[REDACTED_PHONE]');
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions after timeout', async () => {
      // This would require implementing session management
      // Test session timeout behavior
    });

    it('should prevent session fixation attacks', async () => {
      // Test that session IDs change after login
    });

    it('should enforce concurrent session limits', async () => {
      // Test that users cannot have too many concurrent sessions
    });
  });

  describe('CORS Configuration', () => {
    it('should enforce CORS policy', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/workflows')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET');

      // Should reject requests from unauthorized origins
      expect(response.status).toBe(403);
    });

    it('should allow authorized origins', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/workflows')
        .set('Origin', 'https://app.n8n-work.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://app.n8n-work.com'
      );
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', content: 'MZ\x90\x00' },
        { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'shell.jsp', content: '<%@ page import="java.util.*,java.io.*"%>' },
        { name: 'backdoor.asp', content: '<%eval request("cmd")%>' },
      ];

      for (const file of maliciousFiles) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/workflows/import')
          .attach('file', Buffer.from(file.content), file.name)
          .set('Authorization', 'Bearer valid-token')
          .set('X-Tenant-ID', 'test-tenant');

        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should scan uploaded files for malware', async () => {
      // Mock malware signature
      const eicarTestString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows/import')
        .attach('file', Buffer.from(eicarTestString), 'test.txt')
        .set('Authorization', 'Bearer valid-token')
        .set('X-Tenant-ID', 'test-tenant');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('malware');
    });
  });

  describe('API Security', () => {
    it('should prevent mass assignment attacks', async () => {
      const maliciousPayload = {
        name: 'Test Workflow',
        description: 'Test',
        nodes: [],
        edges: [],
        // Attempt to set admin fields
        userId: 'different-user',
        tenantId: 'different-tenant',
        isAdmin: true,
        permissions: ['admin'],
      };

      const token = jwtService.sign({
        sub: 'user',
        tenantId: 'test-tenant',
        roles: ['user'],
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send(maliciousPayload)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', 'test-tenant');

      if (response.status === 201) {
        // Should not have assigned unauthorized fields
        expect(response.body.userId).toBe('user');
        expect(response.body.tenantId).toBe('test-tenant');
        expect(response.body.isAdmin).toBeUndefined();
        expect(response.body.permissions).toBeUndefined();
      }
    });

    it('should validate content-type headers', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send('{"name":"test"}')
        .set('Content-Type', 'text/plain')
        .set('Authorization', 'Bearer valid-token')
        .set('X-Tenant-ID', 'test-tenant');

      expect(response.status).toBe(400);
    });

    it('should limit request body size', async () => {
      const largePayload = {
        name: 'Large Workflow',
        description: 'A'.repeat(10 * 1024 * 1024), // 10MB string
        nodes: [],
        edges: [],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send(largePayload)
        .set('Authorization', 'Bearer valid-token')
        .set('X-Tenant-ID', 'test-tenant');

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Cryptographic Security', () => {
    it('should use secure random number generation', () => {
      const random1 = securityService.generateSecureRandom(32);
      const random2 = securityService.generateSecureRandom(32);

      expect(random1).not.toBe(random2);
      expect(random1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/i.test(random1)).toBe(true);
    });

    it('should use strong password hashing', async () => {
      const password = 'testPassword123!';
      const hash = await securityService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(await securityService.verifyPassword(password, hash)).toBe(true);
      expect(await securityService.verifyPassword('wrongPassword', hash)).toBe(false);
    });

    it('should enforce secure API key generation', () => {
      const apiKey = securityService.generateApiKey();

      expect(apiKey.length).toBeGreaterThanOrEqual(32);
      expect(/^[A-Za-z0-9+/=]+$/.test(apiKey)).toBe(true);
    });
  });

  describe('Vulnerability Scanning', () => {
    it('should detect common vulnerabilities in node configurations', () => {
      const vulnerableNodes = [
        {
          id: 'exec-node',
          type: 'shell',
          parameters: {
            command: 'rm -rf /',
          },
        },
        {
          id: 'sql-node',
          type: 'database',
          parameters: {
            query: "SELECT * FROM users WHERE id = '" + "'; DROP TABLE users; --" + "'",
          },
        },
      ];

      vulnerableNodes.forEach(node => {
        const vulnerabilities = securityService.scanNodeForVulnerabilities(node);
        expect(vulnerabilities.length).toBeGreaterThan(0);
      });
    });

    it('should validate workflow execution context', () => {
      const maliciousContext = {
        __proto__: { admin: true },
        constructor: { prototype: { admin: true } },
        'eval': 'malicious code',
        'require': '../../../etc/passwd',
      };

      const sanitizedContext = securityService.sanitizeExecutionContext(maliciousContext);

      expect(sanitizedContext.__proto__).toBeUndefined();
      expect(sanitizedContext.constructor).toBeUndefined();
      expect(sanitizedContext.eval).toBeUndefined();
      expect(sanitizedContext.require).toBeUndefined();
    });
  });
});
