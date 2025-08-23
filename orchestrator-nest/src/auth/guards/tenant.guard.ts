import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract tenant from request (can be from headers, params, or user object)
    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      throw new ForbiddenException('Tenant not specified');
    }

    // Verify user has access to this tenant
    if (user.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    // Add tenant to request for easy access in controllers
    request.tenant = { id: tenantId };

    return true;
  }

  private extractTenantId(request: any): string | null {
    // Try to get tenant from various sources
    const tenantFromHeader = request.headers['x-tenant-id'];
    const tenantFromQuery = request.query.tenantId;
    const tenantFromUser = request.user?.tenantId;

    return tenantFromHeader || tenantFromQuery || tenantFromUser || null;
  }
}