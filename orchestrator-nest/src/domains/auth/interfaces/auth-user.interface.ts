export interface AuthUser {
  id: string;
  userId: string; // Alias for id to match expected usage
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthContext {
  user: AuthUser;
  tenant: {
    id: string;
    name: string;
    plan: string;
  };
  session: {
    id: string;
    ipAddress: string;
    userAgent: string;
  };
}