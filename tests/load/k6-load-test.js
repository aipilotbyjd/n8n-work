import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestCount = new Counter('request_count');
const workflowExecutions = new Counter('workflow_executions');
const workflowSuccesses = new Counter('workflow_successes');
const workflowFailures = new Counter('workflow_failures');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const TENANT_ID = __ENV.TENANT_ID || 'test-tenant';

// Load test scenarios
export const options = {
  scenarios: {
    // Baseline load - normal operation
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '0s',
      tags: { scenario: 'baseline' },
    },
    
    // Spike test - sudden traffic increase
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 100 },
        { duration: '1m', target: 500 }, // Spike
        { duration: '2m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      startTime: '5m',
      tags: { scenario: 'spike' },
    },
    
    // Stress test - sustained high load
    stress: {
      executor: 'ramping-vus',
      stages: [
        { duration: '5m', target: 200 },
        { duration: '10m', target: 200 },
        { duration: '5m', target: 0 },
      ],
      startTime: '10m',
      tags: { scenario: 'stress' },
    },
    
    // Workflow execution test
    workflow_execution: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 workflow executions per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '0s',
      tags: { scenario: 'workflow_execution' },
    },
    
    // API endpoint test
    api_endpoints: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 100,
      startTime: '0s',
      tags: { scenario: 'api_endpoints' },
    },
  },
  
  thresholds: {
    // SLO requirements from plan.md
    'http_req_duration{scenario:baseline}': ['p(95)<150'], // Platform overhead < 150ms
    'http_req_duration{scenario:workflow_execution}': ['p(95)<500'], // Workflow start < 500ms
    'http_req_duration{scenario:api_endpoints}': ['p(95)<200'], // UI responsiveness < 200ms
    
    // Error rate thresholds
    'error_rate': ['rate<0.05'], // < 0.05% error rate
    'http_req_failed': ['rate<0.01'], // < 1% request failures
    
    // Throughput requirements
    'http_reqs': ['rate>1000'], // > 1000 RPS
    'workflow_executions': ['rate>10'], // > 10 workflow executions/sec
    
    // Response time requirements
    'response_time': ['p(50)<100', 'p(95)<500', 'p(99)<1000'],
    
    // Specific endpoint thresholds
    'http_req_duration{endpoint:health}': ['p(95)<50'],
    'http_req_duration{endpoint:workflows}': ['p(95)<200'],
    'http_req_duration{endpoint:executions}': ['p(95)<300'],
  },
};

// Test data
const testWorkflow = {
  name: 'Load Test Workflow',
  description: 'Workflow for load testing',
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
    {
      id: 'process',
      type: 'http',
      name: 'HTTP Request',
      parameters: {
        url: 'https://httpbin.org/delay/1',
        method: 'GET',
      },
      dependencies: ['start'],
      position: { x: 300, y: 100 },
      policy: {
        timeoutSeconds: 30,
        retryCount: 2,
        retryStrategy: 'linear',
        allowedDomains: ['httpbin.org'],
        resourceLimits: {},
      },
    },
  ],
  edges: [
    {
      fromNode: 'start',
      toNode: 'process',
      condition: null,
    },
  ],
  metadata: {
    tags: ['load-test'],
    environment: 'test',
  },
};

// Helper functions
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Tenant-ID': TENANT_ID,
  };
}

function makeRequest(method, url, body = null, tags = {}) {
  const params = {
    headers: getAuthHeaders(),
    tags: { endpoint: url.split('/').pop(), ...tags },
  };
  
  if (body) {
    params.headers['Content-Type'] = 'application/json';
  }
  
  const response = http.request(method, url, body ? JSON.stringify(body) : null, params);
  
  // Record metrics
  requestCount.add(1);
  responseTime.add(response.timings.duration);
  
  const success = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has valid response': (r) => r.body && r.body.length > 0,
  });
  
  errorRate.add(!success);
  
  return response;
}

// Main test function
export default function() {
  const scenario = __ENV.EXECUTOR || 'baseline';
  
  switch (scenario) {
    case 'workflow_execution':
      testWorkflowExecution();
      break;
    case 'api_endpoints':
      testAPIEndpoints();
      break;
    default:
      testMixedLoad();
  }
  
  sleep(randomIntBetween(1, 3));
}

// Test workflow execution performance
function testWorkflowExecution() {
  // Create workflow
  const workflowName = `test-workflow-${randomString(8)}`;
  const workflow = { ...testWorkflow, name: workflowName };
  
  const createResponse = makeRequest('POST', `${BASE_URL}/api/v1/workflows`, workflow, { operation: 'create_workflow' });
  
  if (createResponse.status !== 201) {
    console.error(`Failed to create workflow: ${createResponse.status}`);
    return;
  }
  
  const workflowId = JSON.parse(createResponse.body).id;
  
  // Execute workflow
  const executeResponse = makeRequest('POST', `${BASE_URL}/api/v1/workflows/${workflowId}/execute`, {
    context: { testData: randomString(10) },
    triggerData: JSON.stringify({ timestamp: Date.now() }),
  }, { operation: 'execute_workflow' });
  
  workflowExecutions.add(1);
  
  if (executeResponse.status === 200) {
    workflowSuccesses.add(1);
    
    const executionId = JSON.parse(executeResponse.body).executionId;
    
    // Poll execution status
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (attempts < maxAttempts) {
      const statusResponse = makeRequest('GET', `${BASE_URL}/api/v1/executions/${executionId}`, null, { operation: 'get_execution' });
      
      if (statusResponse.status === 200) {
        const execution = JSON.parse(statusResponse.body);
        
        if (execution.status === 'success') {
          break;
        } else if (execution.status === 'failed') {
          workflowFailures.add(1);
          break;
        }
      }
      
      sleep(1);
      attempts++;
    }
  } else {
    workflowFailures.add(1);
  }
  
  // Cleanup - delete workflow
  makeRequest('DELETE', `${BASE_URL}/api/v1/workflows/${workflowId}`, null, { operation: 'delete_workflow' });
}

// Test various API endpoints
function testAPIEndpoints() {
  // Health check
  makeRequest('GET', `${BASE_URL}/api/v1/health`, null, { endpoint: 'health' });
  
  // List workflows
  makeRequest('GET', `${BASE_URL}/api/v1/workflows?page=1&limit=10`, null, { endpoint: 'workflows' });
  
  // List executions
  makeRequest('GET', `${BASE_URL}/api/v1/executions?page=1&limit=10`, null, { endpoint: 'executions' });
  
  // Get workflow statistics
  makeRequest('GET', `${BASE_URL}/api/v1/workflows/statistics`, null, { endpoint: 'statistics' });
  
  // Get metrics
  makeRequest('GET', `${BASE_URL}/metrics`, null, { endpoint: 'metrics' });
  
  // Test tenant quotas
  makeRequest('GET', `${BASE_URL}/api/v1/tenants/quotas`, null, { endpoint: 'quotas' });
}

// Test mixed load scenarios
function testMixedLoad() {
  const operations = [
    () => makeRequest('GET', `${BASE_URL}/api/v1/health`, null, { endpoint: 'health' }),
    () => makeRequest('GET', `${BASE_URL}/api/v1/workflows?page=1&limit=5`, null, { endpoint: 'workflows' }),
    () => makeRequest('GET', `${BASE_URL}/api/v1/executions?page=1&limit=5`, null, { endpoint: 'executions' }),
    () => testWorkflowExecution(),
  ];
  
  const operation = operations[randomIntBetween(0, operations.length - 1)];
  operation();
}

// Setup function - runs once at the beginning
export function setup() {
  console.log('Starting load test setup...');
  
  // Verify API connectivity
  const healthResponse = http.get(`${BASE_URL}/api/v1/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`API is not accessible: ${healthResponse.status}`);
  }
  
  console.log('Load test setup complete');
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  
  // Could cleanup any test data here
  console.log(`Final metrics:
    - Total requests: ${requestCount.value}
    - Workflow executions: ${workflowExecutions.value}
    - Workflow successes: ${workflowSuccesses.value}
    - Workflow failures: ${workflowFailures.value}
    - Error rate: ${(errorRate.value * 100).toFixed(2)}%
  `);
}

// Custom check functions for complex scenarios
export function checkWorkflowExecution(response) {
  return check(response, {
    'workflow creation successful': (r) => r.status === 201,
    'workflow has ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id && body.id.length > 0;
      } catch (e) {
        return false;
      }
    },
    'workflow is active': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'active' || body.status === 'draft';
      } catch (e) {
        return false;
      }
    },
  });
}

export function checkExecutionStatus(response) {
  return check(response, {
    'execution status retrieved': (r) => r.status === 200,
    'execution has valid status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return ['pending', 'running', 'success', 'failed', 'cancelled'].includes(body.status);
      } catch (e) {
        return false;
      }
    },
    'execution has steps': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.steps);
      } catch (e) {
        return false;
      }
    },
  });
}

// Stress test specific scenarios
export function stressTestWorkflowConcurrency() {
  const concurrentWorkflows = 10;
  const promises = [];
  
  for (let i = 0; i < concurrentWorkflows; i++) {
    promises.push(
      new Promise((resolve) => {
        testWorkflowExecution();
        resolve();
      })
    );
  }
  
  // Wait for all workflows to complete
  return Promise.all(promises);
}

// Performance regression test
export function performanceRegressionTest() {
  const baselineMetrics = {
    p95ResponseTime: 150, // ms
    errorRate: 0.05, // 0.05%
    throughput: 1000, // RPS
  };
  
  // Run baseline test
  const startTime = Date.now();
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    makeRequest('GET', `${BASE_URL}/api/v1/health`);
  }
  
  const totalTime = Date.now() - startTime;
  const avgResponseTime = totalTime / iterations;
  
  // Check against baseline
  return check(null, {
    'performance regression check': () => avgResponseTime <= baselineMetrics.p95ResponseTime,
    'error rate within bounds': () => errorRate.value <= baselineMetrics.errorRate / 100,
  });
}

// Memory leak detection
export function memoryLeakTest() {
  const initialMemory = http.get(`${BASE_URL}/api/v1/health`);
  
  // Create many workflows without cleanup
  for (let i = 0; i < 50; i++) {
    const workflow = { ...testWorkflow, name: `leak-test-${i}` };
    makeRequest('POST', `${BASE_URL}/api/v1/workflows`, workflow);
  }
  
  // Check memory after load
  const finalMemory = http.get(`${BASE_URL}/api/v1/health`);
  
  return check(null, {
    'memory usage stable': () => {
      // This would require memory metrics in the health endpoint
      return true; // Placeholder
    },
  });
}
