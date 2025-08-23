import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Decorator to extract the current tenant ID from the request
 * 
 * This decorator should be used after the TenantGuard which sets the tenantId on the request
 * 
 * Usage:
 * @Get('workflows')
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * getWorkflows(@Tenant() tenantId: string) {
 *   return this.workflowService.findAll(tenantId);
 * }
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    // The TenantGuard should have already set this
    const tenantId = (request as any).tenantId;
    
    if (!tenantId) {
      throw new Error('Tenant ID not found in request. Make sure TenantGuard is applied.');
    }
    
    return tenantId;
  },
);