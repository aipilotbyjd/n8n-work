import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Webhook, WebhookStatus, AuthenticationType } from './entities/webhook.entity';
import { WebhookExecution, ExecutionStatus } from './entities/webhook-execution.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import { ProcessWebhookDto } from './dto/process-webhook.dto';
import { AuditLogService } from '../audit/audit-log.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookExecution)
    private readonly executionRepository: Repository<WebhookExecution>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly auditService: AuditLogService,
  ) { }

  async create(
    createWebhookDto: CreateWebhookDto,
    tenantId: string,
    userId: string,
  ): Promise<WebhookResponseDto> {
    this.logger.log(`Creating webhook for workflow ${createWebhookDto.workflowId}`);

    const webhookPath = this.generateWebhookPath();
    const webhookUrl = this.buildWebhookUrl(webhookPath);
    const secret = this.generateWebhookSecret();

    const webhook = this.webhookRepository.create({
      ...createWebhookDto,
      tenantId,
      createdBy: userId,
      path: webhookPath,
      url: webhookUrl,
      secret,
      status: WebhookStatus.ACTIVE,
    });

    const savedWebhook = await this.webhookRepository.save(webhook);

    this.eventEmitter.emit('webhook.created', {
      webhook: savedWebhook,
      tenantId,
      userId,
    });

    await this.auditService.log({
      action: 'webhook.created',
      resourceType: 'webhook',
      resourceId: savedWebhook.id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: {
        workflowId: savedWebhook.workflowId,
        path: savedWebhook.path,
      },
    });

    return this.toResponseDto(savedWebhook);
  }

  async findAll(tenantId: string): Promise<WebhookResponseDto[]> {
    const webhooks = await this.webhookRepository.find({
      where: { tenantId },
      relations: ['createdBy', 'updatedBy'],
      order: { createdAt: 'DESC' },
    });

    return webhooks.map(webhook => this.toResponseDto(webhook));
  }

  async findOne(id: string, tenantId: string): Promise<WebhookResponseDto> {
    const webhook = await this.getWebhookEntity(id, tenantId);
    return this.toResponseDto(webhook);
  }

  async findByPath(path: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { path, status: WebhookStatus.ACTIVE },
      relations: ['workflow'],
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook with path ${path} not found`);
    }

    return webhook;
  }

  async update(
    id: string,
    updateWebhookDto: UpdateWebhookDto,
    tenantId: string,
    userId: string,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.getWebhookEntity(id, tenantId);

    if (updateWebhookDto.authenticationType &&
      updateWebhookDto.authenticationType !== webhook.authenticationType) {
      webhook.secret = this.generateWebhookSecret();
    }

    Object.assign(webhook, updateWebhookDto, {
      updatedBy: userId,
    });

    const savedWebhook = await this.webhookRepository.save(webhook);

    this.eventEmitter.emit('webhook.updated', {
      webhook: savedWebhook,
      tenantId,
      userId,
    });

    await this.auditService.log({
      action: 'webhook.updated',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: updateWebhookDto,
    });

    return this.toResponseDto(savedWebhook);
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const webhook = await this.getWebhookEntity(id, tenantId);

    await this.webhookRepository.remove(webhook);

    this.eventEmitter.emit('webhook.deleted', {
      webhookId: id,
      tenantId,
      userId,
    });

    await this.auditService.log({
      action: 'webhook.deleted',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      oldValues: {
        workflowId: webhook.workflowId,
        path: webhook.path,
      },
    });
  }

  async processWebhook(
    path: string,
    processDto: ProcessWebhookDto,
    headers: Record<string, string>,
    ipAddress: string,
  ): Promise<{ success: boolean; executionId?: string; message: string }> {
    try {
      const webhook = await this.findByPath(path);

      if (webhook.status !== WebhookStatus.ACTIVE) {
        throw new BadRequestException('Webhook is not active');
      }

      if (webhook.rateLimitPerMinute) {
        const canProceed = await this.checkRateLimit(webhook.id, webhook.rateLimitPerMinute);
        if (!canProceed) {
          throw new BadRequestException('Rate limit exceeded');
        }
      }

      const isAuthenticated = await this.authenticateRequest(
        webhook,
        processDto,
        headers,
      );

      if (!isAuthenticated) {
        throw new BadRequestException('Authentication failed');
      }

      const execution = this.executionRepository.create({
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        requestHeaders: headers,
        requestBody: processDto.body,
        requestMethod: processDto.method,
        ipAddress,
        status: ExecutionStatus.PROCESSING,
      });

      const savedExecution = await this.executionRepository.save(execution);

      webhook.requestCount = (webhook.requestCount || 0) + 1;
      webhook.lastTriggeredAt = new Date();
      await this.webhookRepository.save(webhook);

      this.eventEmitter.emit('webhook.triggered', {
        webhook,
        execution: savedExecution,
        data: processDto.body,
        headers,
      });

      return {
        success: true,
        executionId: savedExecution.id,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(`Webhook processing failed for path ${path}:`, error);

      return {
        success: false,
        message: error.message || 'Webhook processing failed',
      };
    }
  }

  private async getWebhookEntity(id: string, tenantId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id, tenantId },
      relations: ['createdBy', 'updatedBy'],
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    return webhook;
  }

  private generateWebhookPath(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private buildWebhookUrl(path: string): string {
    const baseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/webhooks/${path}`;
  }

  private async checkRateLimit(webhookId: string, limitPerMinute: number): Promise<boolean> {
    return true;
  }

  private async authenticateRequest(
    webhook: Webhook,
    processDto: ProcessWebhookDto,
    headers: Record<string, string>,
  ): Promise<boolean> {
    switch (webhook.authenticationType) {
      case AuthenticationType.NONE:
        return true;

      case AuthenticationType.HEADER:
        const expectedHeader = webhook.authenticationData?.headerName;
        const expectedValue = webhook.authenticationData?.headerValue;
        return headers[expectedHeader?.toLowerCase()] === expectedValue;

      case AuthenticationType.SIGNATURE:
        return this.validateSignature(
          processDto.body,
          headers['x-signature'] || headers['x-hub-signature-256'],
          webhook.secret,
        );

      case AuthenticationType.BASIC:
        const authHeader = headers['authorization'];
        if (!authHeader?.startsWith('Basic ')) {
          return false;
        }

        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');

        return (
          username === webhook.authenticationData?.username &&
          password === webhook.authenticationData?.password
        );

      default:
        return false;
    }
  }

  private validateSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payloadString);
      const expectedSignature = 'sha256=' + hmac.digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Signature validation error:', error);
      return false;
    }
  }

  private toResponseDto(webhook: Webhook): WebhookResponseDto {
    return {
      id: webhook.id,
      workflowId: webhook.workflowId,
      name: webhook.name,
      description: webhook.description,
      path: webhook.path,
      url: webhook.url,
      method: webhook.method,
      status: webhook.status,
      authenticationType: webhook.authenticationType,
      rateLimitPerMinute: webhook.rateLimitPerMinute,
      timeoutMs: webhook.timeoutMs,
      requestCount: webhook.requestCount,
      lastTriggeredAt: webhook.lastTriggeredAt,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}