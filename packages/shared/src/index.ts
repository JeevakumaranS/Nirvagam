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
  mustChangePassword?: boolean;
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
  mustChangePassword?: boolean;
}

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
}

export interface GstCalculationOptions {
  pricesIncludeTax?: boolean;
  sellerRegisteredForGst?: boolean;
  otherCharges?: number;
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
  MANUAL_IN = 'MANUAL_IN',
  MANUAL_OUT = 'MANUAL_OUT',
  IN_PURCHASE = 'IN_PURCHASE',
  OUT_SALE = 'OUT_SALE',
  IN_TRANSFER = 'IN_TRANSFER',
  OUT_TRANSFER = 'OUT_TRANSFER',
  RETURN_IN_CREDIT_NOTE = 'RETURN_IN_CREDIT_NOTE',
  RETURN_OUT_DEBIT_NOTE = 'RETURN_OUT_DEBIT_NOTE',
}

export enum InvoiceType {
  TAX_INVOICE = 'TAX_INVOICE',
  BILL_OF_SUPPLY = 'BILL_OF_SUPPLY',
  NON_GST = 'NON_GST',
  PROFORMA = 'PROFORMA',
  QUOTATION = 'QUOTATION',
  ESTIMATE = 'ESTIMATE',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
  SALES_RETURN = 'SALES_RETURN',
  RECURRING_INVOICE = 'RECURRING_INVOICE',
  POS_RECEIPT = 'POS_RECEIPT',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMode {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  CREDIT = 'CREDIT',
}

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
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
  invoiceDiscount = 0,
  options: GstCalculationOptions = {}
): GstCalculationResult {
  const isInterState = businessStateCode.trim().toUpperCase() !== customerStateCode.trim().toUpperCase();
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const sellerRegistered = options.sellerRegisteredForGst !== false;
  const lines = items.map((item) => {
    const discount = Math.max(0, item.discountAmount || 0);
    const rate = sellerRegistered ? Math.max(0, item.gstRate) : 0;
    const discountedPrice = Math.max(0, item.quantity * item.unitPrice - discount);
    const taxableValue =
      options.pricesIncludeTax && rate > 0
        ? roundMoney(discountedPrice / (1 + rate / 100))
        : roundMoney(discountedPrice);

    return { item, rate, taxableValue };
  });
  const taxableBeforeInvoiceDiscount = lines.reduce((sum, line) => sum + line.taxableValue, 0);
  const appliedInvoiceDiscount = Math.min(Math.max(0, invoiceDiscount), taxableBeforeInvoiceDiscount);
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let allocatedInvoiceDiscount = 0;

  const calculatedItems = lines.map(({ item, rate, taxableValue: initialTaxableValue }, index) => {
    const allocatedDiscount =
      index === lines.length - 1
        ? roundMoney(appliedInvoiceDiscount - allocatedInvoiceDiscount)
        : taxableBeforeInvoiceDiscount > 0
        ? roundMoney((appliedInvoiceDiscount * initialTaxableValue) / taxableBeforeInvoiceDiscount)
        : 0;
    allocatedInvoiceDiscount += allocatedDiscount;
    const taxableValue = roundMoney(Math.max(0, initialTaxableValue - allocatedDiscount));
    const totalItemTax = roundMoney((taxableValue * rate) / 100);
    const cgstRate = isInterState ? 0 : rate / 2;
    const sgstRate = isInterState ? 0 : rate / 2;
    const igstRate = isInterState ? rate : 0;
    const cgstAmount = isInterState ? 0 : roundMoney(totalItemTax / 2);
    const sgstAmount = isInterState ? 0 : roundMoney(totalItemTax - cgstAmount);
    const igstAmount = isInterState ? totalItemTax : 0;

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
      totalAmount: roundMoney(taxableValue + totalItemTax),
    };
  });

  totalTaxable = roundMoney(totalTaxable);
  totalCgst = roundMoney(totalCgst);
  totalSgst = roundMoney(totalSgst);
  totalIgst = roundMoney(totalIgst);
  const rawTotal =
    totalTaxable + totalCgst + totalSgst + totalIgst + Math.max(0, options.otherCharges || 0);
  const roundedNetTotal = Math.round(rawTotal);
  const roundOffAmount = roundMoney(roundedNetTotal - rawTotal);

  return {
    isInterState,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax: roundMoney(totalCgst + totalSgst + totalIgst),
    roundOffAmount,
    netTotal: roundedNetTotal,
    items: calculatedItems,
  };
}
