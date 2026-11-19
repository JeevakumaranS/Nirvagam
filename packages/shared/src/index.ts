export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum PlanTier {
  STARTER = 'STARTER',
  BUSINESS = 'BUSINESS',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BusinessType {
  PROPRIETORSHIP = 'PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  LLP = 'LLP',
  PRIVATE_LIMITED = 'PRIVATE_LIMITED',
  PUBLIC_LIMITED = 'PUBLIC_LIMITED',
  INDIVIDUAL = 'INDIVIDUAL',
  OTHER = 'OTHER',
}

export enum IndustryType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  SUPERMARKET = 'SUPERMARKET',
  TEXTILE = 'TEXTILE',
  GROCERY = 'GROCERY',
  ELECTRICAL = 'ELECTRICAL',
  HARDWARE = 'HARDWARE',
  MEDICAL = 'MEDICAL',
  RESTAURANT = 'RESTAURANT',
  MANUFACTURING = 'MANUFACTURING',
  DISTRIBUTOR = 'DISTRIBUTOR',
  SERVICE = 'SERVICE',
  TRADING = 'TRADING',
  OTHER = 'OTHER',
}

export enum AccountGroup {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum UserRoleName {
  SUPER_ADMIN = 'SUPER_ADMIN',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  BUSINESS_ADMIN = 'BUSINESS_ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  MANAGER = 'MANAGER',
  SALES_EXECUTIVE = 'SALES_EXECUTIVE',
  CASHIER = 'CASHIER',
  PURCHASE_MANAGER = 'PURCHASE_MANAGER',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  AUDITOR = 'AUDITOR',
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  businessId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  businessId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
}

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: unknown;
  message?: string;
}
