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

export type PurchaseDiscountType = 'PERCENT' | 'AMOUNT';
export type PurchaseFreightAllocationMethod = 'VALUE' | 'QUANTITY' | 'WEIGHT';

export interface PurchaseCalculationLine {
  id: string;
  quantity: string;
  rate: string;
  weight?: string;
  lineDiscountType?: PurchaseDiscountType;
  lineDiscountValue?: string;
  taxRate: string;
}

export interface PurchaseCalculationCharge {
  name: string;
  type: 'LOADING' | 'PACKING' | 'INSURANCE' | 'FREIGHT' | 'OTHER';
  amount: string;
  isTaxable: boolean;
  taxRate?: string;
  allocationMethod?: PurchaseFreightAllocationMethod;
  accountId?: string;
}

export interface PurchaseCalculationOptions {
  businessStateCode: string;
  supplierStateCode: string;
  pricesIncludeTax?: boolean;
  invoiceDiscountType?: PurchaseDiscountType;
  invoiceDiscountValue?: string;
  roundOff?: string;
  charges?: PurchaseCalculationCharge[];
}

export interface PurchaseCalculationLineResult {
  id: string;
  lineAmount: string;
  lineDiscount: string;
  taxableValue: string;
  invoiceDiscount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  vatAmount: string;
  taxAmount: string;
  landedCost: string;
  totalAmount: string;
  rule: Record<string, string>;
}

export interface PurchaseCalculationResult {
  isInterState: boolean;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  vatAmount: string;
  totalTax: string;
  additionalCharges: string;
  roundOff: string;
  grandTotal: string;
  taxSummary: Array<{ rate: string; taxable: string; tax: string }>;
  items: PurchaseCalculationLineResult[];
  rule: Record<string, unknown>;
}

const DECIMAL_SCALE = 100n;
const THREE_SCALE = 1000n;

function decimalToUnits(value: string | number | undefined, scale: bigint): bigint {
  const raw = String(value ?? '0').trim();
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const digits = fraction.padEnd(Number(scale.toString().length - 1), '0').slice(0, Number(scale.toString().length - 1));
  const result = BigInt(whole || '0') * scale + BigInt(digits || '0');
  return negative ? -result : result;
}

function unitsToDecimal(value: bigint, scale: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / scale;
  const fraction = absolute % scale;
  if (fraction === 0n) return `${negative ? '-' : ''}${whole}`;
  const places = Number(scale.toString().length - 1);
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(places, '0').replace(/0+$/, '')}`;
}

function money(value: bigint): string {
  return unitsToDecimal(roundToMoney(value), DECIMAL_SCALE);
}

function roundToMoney(value: bigint): bigint {
  return value;
}

function roundDivision(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  if (numerator >= 0n) return (numerator + denominator / 2n) / denominator;
  return -((-numerator + denominator / 2n) / denominator);
}

function multiplyDecimal(a: bigint, b: bigint, aScale: bigint, bScale: bigint): bigint {
  return (a * b) / (aScale * bScale / DECIMAL_SCALE);
}

function percentOf(value: bigint, percent: bigint): bigint {
  return roundDivision(value * percent, 100n * DECIMAL_SCALE);
}

export function calculatePurchaseDocument(
  lines: PurchaseCalculationLine[],
  options: PurchaseCalculationOptions
): PurchaseCalculationResult {
  const isInterState = options.businessStateCode.trim().toUpperCase() !== options.supplierStateCode.trim().toUpperCase();
  const calculatedLines: PurchaseCalculationLineResult[] = [];
  let totalTaxable = 0n;
  let totalCgst = 0n;
  let totalSgst = 0n;
  let totalIgst = 0n;
  let totalVat = 0n;

  const preDiscountTaxables: bigint[] = [];
  const grossAmounts: bigint[] = [];

  for (const line of lines) {
    const quantity = decimalToUnits(line.quantity, THREE_SCALE);
    const rate = decimalToUnits(line.rate, DECIMAL_SCALE);
    const gross = roundDivision(quantity * rate, THREE_SCALE);
    let lineDiscount = 0n;
    if (line.lineDiscountType === 'PERCENT') {
      const percent = decimalToUnits(line.lineDiscountValue || '0', DECIMAL_SCALE);
      lineDiscount = percentOf(gross, percent);
    } else {
      lineDiscount = decimalToUnits(line.lineDiscountValue || '0', DECIMAL_SCALE);
    }
    lineDiscount = lineDiscount > gross ? gross : lineDiscount;
    let net = gross - lineDiscount;
    const taxRate = decimalToUnits(line.taxRate, DECIMAL_SCALE);
    if (options.pricesIncludeTax && taxRate > 0n) {
      net = roundDivision(net * 10000n, 10000n + taxRate);
    }
    grossAmounts.push(gross);
    preDiscountTaxables.push(net);
  }

  const beforeInvoiceDiscount = preDiscountTaxables.reduce((sum, value) => sum + value, 0n);
  const invoiceValue = decimalToUnits(options.invoiceDiscountValue || '0', DECIMAL_SCALE);
  let invoiceDiscount =
    options.invoiceDiscountType === 'PERCENT'
      ? percentOf(beforeInvoiceDiscount, invoiceValue)
      : invoiceValue;
  invoiceDiscount = invoiceDiscount > beforeInvoiceDiscount ? beforeInvoiceDiscount : invoiceDiscount;

  let allocatedDiscount = 0n;
  preDiscountTaxables.forEach((initialTaxable, index) => {
    const invoiceLineDiscount =
      index === preDiscountTaxables.length - 1
        ? invoiceDiscount - allocatedDiscount
        : beforeInvoiceDiscount > 0n
          ? roundDivision(invoiceDiscount * initialTaxable, beforeInvoiceDiscount)
          : 0n;
    allocatedDiscount += invoiceLineDiscount;

    const line = lines[index];
    const gross = grossAmounts[index];
    const quantity = decimalToUnits(line.quantity, THREE_SCALE);
    const rate = decimalToUnits(line.rate, DECIMAL_SCALE);
    let lineDiscount = 0n;
    if (line.lineDiscountType === 'PERCENT') {
      lineDiscount = percentOf(gross, decimalToUnits(line.lineDiscountValue || '0', DECIMAL_SCALE));
    } else {
      lineDiscount = decimalToUnits(line.lineDiscountValue || '0', DECIMAL_SCALE);
    }
    lineDiscount = lineDiscount > gross ? gross : lineDiscount;

    const taxableValue = initialTaxable - invoiceLineDiscount;
    const taxRate = decimalToUnits(line.taxRate, DECIMAL_SCALE);
    const taxAmount = roundDivision(taxableValue * taxRate, 10000n);
    const cgst = isInterState ? 0n : roundDivision(taxAmount, 2n);
    const sgst = isInterState ? 0n : taxAmount - cgst;
    const igst = isInterState ? taxAmount : 0n;

    totalTaxable += taxableValue;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    calculatedLines.push({
      id: line.id,
      lineAmount: money(gross),
      lineDiscount: money(lineDiscount),
      taxableValue: money(taxableValue),
      invoiceDiscount: money(invoiceLineDiscount),
      cgstAmount: money(cgst),
      sgstAmount: money(sgst),
      igstAmount: money(igst),
      vatAmount: '0',
      taxAmount: money(taxAmount),
      landedCost: money(roundDivision(taxableValue * THREE_SCALE, quantity || THREE_SCALE)),
      totalAmount: money(taxableValue + taxAmount),
      rule: {
        pricesIncludeTax: String(options.pricesIncludeTax === true),
        taxRate: unitsToDecimal(taxRate, DECIMAL_SCALE),
        lineDiscountType: line.lineDiscountType || 'AMOUNT',
      },
    });
  });

  const charges = options.charges || [];
  let chargeTax = 0n;
  let additionalCharges = 0n;
  const freightTotal = charges
    .filter((charge) => charge.type === 'FREIGHT')
    .reduce((sum, charge) => sum + decimalToUnits(charge.amount, DECIMAL_SCALE), 0n);

  for (const charge of charges) {
    const amount = decimalToUnits(charge.amount, DECIMAL_SCALE);
    additionalCharges += amount;
    if (charge.isTaxable) {
      const chargeTaxRate = decimalToUnits(charge.taxRate || '0', DECIMAL_SCALE);
      chargeTax += roundDivision(amount * chargeTaxRate, 10000n);
    }
  }

  if (chargeTax > 0n) {
    if (isInterState) totalIgst += chargeTax;
    else {
      const cgst = roundDivision(chargeTax, 2n);
      totalCgst += cgst;
      totalSgst += chargeTax - cgst;
    }
  }

  const taxSummaryMap = new Map<string, { taxable: bigint; tax: bigint }>();
  calculatedLines.forEach((line, index) => {
    const lineTaxable = decimalToUnits(line.taxableValue, DECIMAL_SCALE);
    const taxRate = decimalToUnits(lines[index].taxRate, DECIMAL_SCALE);
    const key = unitsToDecimal(taxRate, DECIMAL_SCALE);
    const existing = taxSummaryMap.get(key) || { taxable: 0n, tax: 0n };
    existing.taxable += lineTaxable;
    existing.tax += decimalToUnits(line.taxAmount, DECIMAL_SCALE);
    taxSummaryMap.set(key, existing);
  });

  const rawGrand = totalTaxable + totalCgst + totalSgst + totalIgst + totalVat + additionalCharges;
  const roundOff = decimalToUnits(options.roundOff || '0', DECIMAL_SCALE);
  const grandTotal = rawGrand + roundOff;

  return {
    isInterState,
    taxableAmount: money(totalTaxable),
    cgstAmount: money(totalCgst),
    sgstAmount: money(totalSgst),
    igstAmount: money(totalIgst),
    vatAmount: money(totalVat),
    totalTax: money(totalCgst + totalSgst + totalIgst + totalVat),
    additionalCharges: money(additionalCharges),
    roundOff: money(roundOff),
    grandTotal: money(grandTotal),
    taxSummary: Array.from(taxSummaryMap.entries()).map(([rate, value]) => ({
      rate,
      taxable: money(value.taxable),
      tax: money(value.tax),
    })),
    items: calculatedLines,
    rule: {
      pricesIncludeTax: options.pricesIncludeTax === true,
      invoiceDiscountType: options.invoiceDiscountType || 'AMOUNT',
      invoiceDiscountValue: options.invoiceDiscountValue || '0',
      chargeCount: charges.length,
      freightAllocationMethod: charges.find((charge) => charge.type === 'FREIGHT')?.allocationMethod || 'VALUE',
      freightTotal: money(freightTotal),
    },
  };
}
