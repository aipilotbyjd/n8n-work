import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

// Extend Request interface to include tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    if (!user) {
      throw new ForbiddenException("User must be authenticated");
    }

    // Extract tenant ID from various sources
    let tenantId: string | undefined;

    // 1. Check URL parameter
    tenantId = request.params.tenantId;

    // 2. Check query parameter
    if (!tenantId) {
      tenantId = request.query.tenantId as string;
    }

    // 3. Check custom header
    if (!tenantId) {
      tenantId = request.headers["x-tenant-id"] as string;
    }

    // 4. Use user's default tenant
    if (!tenantId && user.defaultTenantId) {
      tenantId = user.defaultTenantId;
    }

    // 5. Use first tenant from user's tenant list
    if (!tenantId && user.tenants && user.tenants.length > 0) {
      tenantId = user.tenants[0].id || user.tenants[0];
    }

    if (!tenantId) {
      throw new BadRequestException("Tenant ID is required");
    }

    // Validate user has access to this tenant
    if (!this.hasAccessToTenant(user, tenantId)) {
      throw new ForbiddenException("Access denied to this tenant");
    }

    // Attach tenant ID to request for use in controllers
    request.tenantId = tenantId;

    return true;
  }

  private hasAccessToTenant(user: any, tenantId: string): boolean {
    if (!user.tenants) {
      return false;
    }

    // Check if user belongs to the tenant
    return user.tenants.some((tenant: any) => {
      return (typeof tenant === "string" ? tenant : tenant.id) === tenantId;
    });
  }
}
