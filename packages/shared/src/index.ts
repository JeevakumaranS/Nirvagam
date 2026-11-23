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



export enum UserRoleName {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_SUPER_ADMIN = 'PLATFORM_SUPER_ADMIN',
  PLATFORM_SUPPORT_ADMIN = 'PLATFORM_SUPPORT_ADMIN',
  PLATFORM_FINANCE_ADMIN = 'PLATFORM_FINANCE_ADMIN',
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

export interface SystemLevelRole {
  key: string;
  name: string;
  responsibilities: string;
  description: string;
}

export const SYSTEM_LEVEL_ROLES: SystemLevelRole[] = [
  {
    key: 'PLATFORM_SUPER_ADMIN',
    name: 'Platform Super Admin',
    responsibilities: 'Manage entire SaaS platform',
    description: 'Full administrative control over tenant organizations, schema provisioning, business profiles, and global system configurations.',
  },
  {
    key: 'PLATFORM_SUPPORT_ADMIN',
    name: 'Platform Support Admin',
    responsibilities: 'Customer support and troubleshooting',
    description: 'Investigates customer incidents, inspects tenant logs and workspace health, and diagnoses system errors without financial write access.',
  },
  {
    key: 'PLATFORM_FINANCE_ADMIN',
    name: 'Platform Finance Admin',
    responsibilities: 'Subscription and payment management',
    description: 'Oversees SaaS subscriptions, invoice reconciliation, plan limits, billing schedules, and payment gateway transactions.',
  },
];

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  businessId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
  platformAdmin?: boolean;
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
  platformAdmin?: boolean;
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

export enum AccountGroup {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum StockMovementType {
  IN_PURCHASE = 'IN_PURCHASE',
  OUT_SALE = 'OUT_SALE',
  IN_TRANSFER = 'IN_TRANSFER',
  OUT_TRANSFER = 'OUT_TRANSFER',
  ADJUSTMENT_ADD = 'ADJUSTMENT_ADD',
  ADJUSTMENT_SUB = 'ADJUSTMENT_SUB',
  RETURN_IN_CREDIT_NOTE = 'RETURN_IN_CREDIT_NOTE',
  RETURN_OUT_DEBIT_NOTE = 'RETURN_OUT_DEBIT_NOTE',
}

export enum InvoiceType {
  TAX_INVOICE = 'TAX_INVOICE',
  BILL_OF_SUPPLY = 'BILL_OF_SUPPLY',
  NON_GST = 'NON_GST',
  PROFORMA = 'PROFORMA',
  POS_RECEIPT = 'POS_RECEIPT',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}



export interface GstTaxCalculationItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  gstRate: number;
}

export interface GstCalculationResult {
  isInterState: boolean;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOffAmount: number;
  netTotal: number;
  items: Array<
    GstTaxCalculationItem & {
      taxableValue: number;
      cgstRate: number;
      cgstAmount: number;
      sgstRate: number;
      sgstAmount: number;
      igstRate: number;
      igstAmount: number;
      totalAmount: number;
    }
  >;
}

export function calculateGstInvoice(
  businessStateCode: string,
  customerStateCode: string,
  items: GstTaxCalculationItem[],
  invoiceDiscount = 0
): GstCalculationResult {
  const isInterState = businessStateCode.trim().toUpperCase() !== customerStateCode.trim().toUpperCase();

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedItems = items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const discount = item.discountAmount || 0;
    const taxableValue = Math.round((gross - discount) * 100) / 100;
    const totalItemTax = Math.round(((taxableValue * item.gstRate) / 100) * 100) / 100;

    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;

    if (isInterState) {
      igstRate = item.gstRate;
      igstAmount = totalItemTax;
    } else {
      cgstRate = item.gstRate / 2;
      sgstRate = item.gstRate / 2;
      cgstAmount = Math.round((totalItemTax / 2) * 100) / 100;
      sgstAmount = totalItemTax - cgstAmount;
    }

    totalTaxable += taxableValue;
    totalCgst += cgstAmount;
    totalSgst += sgstAmount;
    totalIgst += igstAmount;

    return {
      ...item,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalAmount: Math.round((taxableValue + totalItemTax) * 100) / 100,
    };
  });

  const rawTotal = totalTaxable - invoiceDiscount + totalCgst + totalSgst + totalIgst;
  const roundedNetTotal = Math.round(rawTotal);
  const roundOffAmount = Math.round((roundedNetTotal - rawTotal) * 100) / 100;

  return {
    isInterState,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    totalCgst: Math.round(totalCgst * 100) / 100,
    totalSgst: Math.round(totalSgst * 100) / 100,
    totalIgst: Math.round(totalIgst * 100) / 100,
    totalTax: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
    roundOffAmount,
    netTotal: roundedNetTotal,
    items: calculatedItems,
  };
}
