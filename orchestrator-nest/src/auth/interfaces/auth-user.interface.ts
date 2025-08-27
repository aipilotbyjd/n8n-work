export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  active?: boolean;
}
