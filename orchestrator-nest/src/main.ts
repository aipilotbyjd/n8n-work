import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";
import { initializeOpenTelemetry } from "./observability/tracing";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { setupSwagger } from "./config/swagger.config";

async function bootstrap() {
  // Initialize OpenTelemetry before importing any other modules
  initializeOpenTelemetry();

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }),
  );

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get("CORS_ORIGIN", "http://localhost:3000"),
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // Comprehensive Swagger Documentation
  setupSwagger(app);

  const port = configService.get("PORT", 3000);
  await app.listen(port);

  logger.log(
    `🚀 N8N-Work Orchestrator is running on: http://localhost:${port}/api`,
  );
  logger.log(
    `📚 API Documentation available at: http://localhost:${port}/api/docs`,
  );
  logger.log(
    `🏥 Health check available at: http://localhost:${port}/api/health`,
  );
  logger.log(`📊 Metrics available at: http://localhost:${port}/metrics`);
}

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

bootstrap();
