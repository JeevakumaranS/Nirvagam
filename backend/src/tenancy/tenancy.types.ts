export type TenantStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'deleting'
  | 'failed';

export interface PlanLimits {
  maxBranches: number;
  maxUsers: number;
  maxInvoicesPerMonth: number;
  featureFlags: Record<string, any>;
}

export interface TenantContext {
  tenantId: string;
  schemaName: string;
  slug: string;
  displayName: string;
  status: TenantStatus;
  identityId?: string;
  userId?: string;
  email?: string;
  roleKeys: string[];
  branchIds: string[];
  planLimits: PlanLimits;
}

export interface TenantRecord {
  id: string;
  slug: string;
  displayName: string;
  schemaName: string;
  status: TenantStatus;
  planId?: string;
  region: string;
  dbCluster: string;
  schemaVersion: number;
  metadata: Record<string, any>;
  planLimits?: PlanLimits;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisionTenantInput {
  slug: string;
  displayName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhone?: string;
  addressLine1: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  gstin?: string;
  pan?: string;
  existingIdentityId?: string;
  planCode?: string;
  region?: string;
  metadata?: Record<string, any>;
}

export interface TenantProvisionResult {
  tenantId: string;
  slug: string;
  schemaName: string;
  status: TenantStatus;
  ownerIdentityId: string;
  defaultBranchId: string | null;
  rolesSeeded: number;
  permissionsSeeded: number;
  coaAccountsSeeded: number;
}
