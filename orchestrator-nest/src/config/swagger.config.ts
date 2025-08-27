import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const environment = configService.get("NODE_ENV", "development");

  // Only enable Swagger in non-production environments
  if (environment === "production") {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle("N8N-Work Orchestrator API")
    .setDescription(
      `
      # N8N-Work Workflow Automation Platform API

      The N8N-Work Orchestrator API provides comprehensive workflow automation capabilities including:

      ## 🔧 Core Features
      - **Workflows**: Create, manage, and execute complex automation workflows
      - **Credentials**: Securely store and manage API keys, OAuth tokens, and other credentials
      - **Executions**: Monitor and control workflow executions with detailed logging
      - **Webhooks**: Handle incoming HTTP requests to trigger workflows
      - **Scheduling**: Set up cron-based workflow triggers
      - **Nodes**: Manage and discover workflow nodes and integrations

      ## 🏢 Enterprise Features
      - **Multi-tenancy**: Complete tenant isolation and management
      - **Authentication**: JWT-based authentication with role-based access control
      - **Audit Logging**: Comprehensive audit trail for compliance
      - **Metrics & Monitoring**: Built-in observability and performance monitoring
      - **Marketplace**: Plugin and integration marketplace support

      ## 🔐 Security
      - All sensitive data is encrypted at rest
      - OAuth 2.0 flows for secure third-party integrations
      - API key management with rotation capabilities
      - Tenant-level data isolation

      ## 🚀 Getting Started
      1. Authenticate using the /auth/login endpoint
      2. Create credentials for your integrations
      3. Build workflows using the visual editor or API
      4. Execute workflows manually or via triggers

      For more information, visit our [documentation](https://docs.n8n-work.com).
      `,
    )
    .setVersion("1.0")
    .setContact(
      "N8N-Work Support",
      "https://n8n-work.com/support",
      "support@n8n-work.com",
    )
    .setLicense(
      "MIT License",
      "https://github.com/n8n-work/orchestrator/blob/main/LICENSE",
    )
    .addServer("http://localhost:3000", "Development Server")
    .addServer("https://api.n8n-work.com", "Production Server")

    // Authentication schemes
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "X-API-Key",
        in: "header",
        description: "API key for service-to-service communication",
      },
      "API-key",
    )
    .addOAuth2(
      {
        type: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "/auth/oauth/authorize",
            tokenUrl: "/auth/oauth/token",
            scopes: {
              read: "Read access to resources",
              write: "Write access to resources",
              admin: "Administrative access",
            },
          },
        },
      },
      "OAuth2",
    )

    // Global tags for better organization
    .addTag("Authentication", "User authentication and session management")
    .addTag("Workflows", "Workflow creation, management, and execution")
    .addTag("Credentials", "Credential storage and OAuth management")
    .addTag("Executions", "Workflow execution monitoring and control")
    .addTag("Webhooks", "Webhook management and payload handling")
    .addTag("Scheduling", "Cron-based workflow scheduling")
    .addTag("Nodes", "Node registry and plugin management")
    .addTag("Tenants", "Multi-tenant organization management")
    .addTag("Audit", "Audit logging and compliance tracking")
    .addTag("Marketplace", "Plugin marketplace and installation")
    .addTag("Health", "System health checks and status")
    .addTag("Metrics", "Performance metrics and monitoring")

    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // Include all controllers and endpoints
    include: [],

    // Deep scanning for better discovery
    deepScanRoutes: true,

    // Custom operation ID generation for better client SDK generation
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      return `${controllerKey}_${methodKey}`;
    },

    // Extra models to include in the documentation
    extraModels: [
      // Add any additional models that should be documented
    ],
  });

  // Custom document transformation to ensure all endpoints are included
  transformDocument(document);

  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      // Enable authorization persistence
      persistAuthorization: true,

      // Display request/response examples
      displayRequestDuration: true,

      // Show extensions
      showExtensions: true,

      // Show common extensions
      showCommonExtensions: true,

      // Default models expansion
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,

      // Enable try-it-out by default
      tryItOutEnabled: true,

      // Filter operations
      filter: true,

      // Deep linking
      deepLinking: true,

      // Custom CSS for better appearance
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .info .title { color: #3b82f6 }
        .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px }
      `,

      // Custom site title
      customSiteTitle: "N8N-Work API Documentation",

      // Custom favicon
      customfavIcon: "/favicon.ico",
    },

    // Custom CSS file
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .info .title { color: #3b82f6; font-size: 2rem; }
      .swagger-ui .info .description { font-size: 1rem; line-height: 1.6; }
      .swagger-ui .scheme-container { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        padding: 20px; 
        border-radius: 12px; 
        color: white; 
      }
      .swagger-ui .scheme-container .schemes { color: white; }
      .swagger-ui .btn.authorize { 
        background: #10b981; 
        border-color: #10b981; 
      }
      .swagger-ui .btn.authorize:hover { 
        background: #059669; 
        border-color: #059669; 
      }
    `,

    // Explorer
    explorer: true,
  });

  console.log("📚 Swagger documentation available at: /api/docs");
  console.log("📄 OpenAPI JSON available at: /api/docs-json");
  console.log("📄 OpenAPI YAML available at: /api/docs-yaml");
}

/**
 * Transform the OpenAPI document to ensure all endpoints are properly documented
 */
function transformDocument(document: any): void {
  // Ensure all endpoints have proper tags
  Object.keys(document.paths || {}).forEach((path) => {
    Object.keys(document.paths[path] || {}).forEach((method) => {
      const operation = document.paths[path][method];

      // Add default tag if none exists
      if (!operation.tags || operation.tags.length === 0) {
        const pathSegments = path.split("/").filter(Boolean);
        const defaultTag = pathSegments[0] || "Default";
        operation.tags = [capitalizeFirstLetter(defaultTag)];
      }

      // Ensure operation has an ID
      if (!operation.operationId) {
        const pathKey = path.replace(/[{}]/g, "").replace(/\//g, "_");
        operation.operationId = `${method}_${pathKey}`;
      }

      // Add common responses if missing
      if (!operation.responses["401"]) {
        operation.responses["401"] = {
          description: "Unauthorized - Authentication required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "number", example: 401 },
                  message: { type: "string", example: "Unauthorized" },
                  timestamp: { type: "string", format: "date-time" },
                  path: { type: "string", example: path },
                },
              },
            },
          },
        };
      }

      // Add 500 response if missing
      if (!operation.responses["500"]) {
        operation.responses["500"] = {
          description: "Internal Server Error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  statusCode: { type: "number", example: 500 },
                  message: { type: "string", example: "Internal server error" },
                  timestamp: { type: "string", format: "date-time" },
                  path: { type: "string", example: path },
                },
              },
            },
          },
        };
      }
    });
  });

  // Add common schemas
  if (!document.components) {
    document.components = {};
  }

  if (!document.components.schemas) {
    document.components.schemas = {};
  }

  // Add common error schemas
  document.components.schemas.ErrorResponse = {
    type: "object",
    properties: {
      statusCode: { type: "number" },
      message: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
      path: { type: "string" },
    },
    required: ["statusCode", "message", "timestamp", "path"],
  };

  document.components.schemas.ValidationErrorResponse = {
    type: "object",
    properties: {
      statusCode: { type: "number", example: 400 },
      message: {
        type: "array",
        items: { type: "string" },
        example: ["name should not be empty", "email must be an email"],
      },
      error: { type: "string", example: "Bad Request" },
      timestamp: { type: "string", format: "date-time" },
      path: { type: "string" },
    },
    required: ["statusCode", "message", "timestamp", "path"],
  };

  document.components.schemas.PaginatedResponse = {
    type: "object",
    properties: {
      data: { type: "array", items: {} },
      pagination: {
        type: "object",
        properties: {
          page: { type: "number", example: 1 },
          limit: { type: "number", example: 10 },
          total: { type: "number", example: 100 },
          totalPages: { type: "number", example: 10 },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
    },
    required: ["data", "pagination"],
  };
}

/**
 * Utility function to capitalize first letter
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Get Swagger document as JSON (useful for external tools)
 */
export function getSwaggerDocument(app: INestApplication): any {
  const configService = app.get(ConfigService);
  const config = new DocumentBuilder()
    .setTitle("N8N-Work Orchestrator API")
    .setVersion("1.0")
    .build();

  return SwaggerModule.createDocument(app, config);
}
