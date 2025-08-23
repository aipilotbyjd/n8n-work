import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  tenants: string[] | { id: string; name: string; role: string }[];
  defaultTenantId?: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
}

/**
 * Decorator to extract the current authenticated user from the request
 * 
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 * 
 * // Get specific property
 * @Get('id')
 * getUserId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return that property
    if (data) {
      return user[data];
    }

    // Return the full user object
    return user;
  },
);