import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PurchaseChargeDto {
  @ApiProperty({ example: 'Transport Service' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '500' })
  @IsNotEmpty()
  amount!: string | number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isTaxable?: boolean;

  @ApiPropertyOptional({ example: '18' })
  @IsOptional()
  taxRate?: string | number;

  @ApiPropertyOptional({ enum: ['VALUE', 'QUANTITY', 'WEIGHT'] })
  @IsIn(['VALUE', 'QUANTITY', 'WEIGHT'])
  @IsOptional()
  allocationMethod?: 'VALUE' | 'QUANTITY' | 'WEIGHT';

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  accountId?: string;
}

export class PurchaseLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional({ example: 'Cotton Yarn 40s' })
  @IsString()
  @IsOptional()
  itemName?: string;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '10' })
  @IsNotEmpty()
  quantity!: string | number;

  @ApiProperty({ example: '100' })
  @IsNotEmpty()
  unitRate!: string | number;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  weight?: string | number;

  @ApiPropertyOptional({ enum: ['PERCENT', 'AMOUNT'], default: 'AMOUNT' })
  @IsIn(['PERCENT', 'AMOUNT'])
  @IsOptional()
  discountType?: 'PERCENT' | 'AMOUNT';

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  discountValue?: string | number;

  @ApiPropertyOptional({ example: '18' })
  @IsOptional()
  taxRate?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  overReceiptTolerance?: string | number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderItemId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  grnItemId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}

export class PurchaseRequestLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional({ example: 'Packing Boxes' })
  @IsString()
  @IsOptional()
  itemName?: string;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '10' })
  @IsNotEmpty()
  quantity!: string | number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  requiredDate?: string;

  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  preferredRate?: string | number;
}

export class CreatePurchaseRequestDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  requestNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  requestDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ default: 'INR' })
  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [PurchaseRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestLineDto)
  items!: PurchaseRequestLineDto[];
}

export class UpdatePurchaseRequestDto extends CreatePurchaseRequestDto {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseRequestId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional({ default: 'INR' })
  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  overReceiptTolerance?: string | number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  pricesIncludeTax?: boolean;

  @ApiPropertyOptional({ enum: ['PERCENT', 'AMOUNT'] })
  @IsIn(['PERCENT', 'AMOUNT'])
  @IsOptional()
  invoiceDiscountType?: 'PERCENT' | 'AMOUNT';

  @ApiPropertyOptional()
  @IsOptional()
  invoiceDiscountValue?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  roundOff?: string | number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiProperty({ type: [PurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  items!: PurchaseLineDto[];

  @ApiPropertyOptional({ type: [PurchaseChargeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseChargeDto)
  @IsOptional()
  charges?: PurchaseChargeDto[];
}

export class UpdatePurchaseOrderDto extends CreatePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}

export class GrnLineInputDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional({ example: 'Packing Boxes' })
  @IsString()
  @IsOptional()
  itemName?: string;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderItemId?: string;

  @ApiProperty({ example: '10' })
  @IsNotEmpty()
  quantity!: string | number;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  rejectedQuantity?: string | number;

  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  unitCost?: string | number;

  @ApiPropertyOptional({ example: '105' })
  @IsOptional()
  landedCost?: string | number;

  @ApiPropertyOptional({ example: '18' })
  @IsOptional()
  taxRate?: string | number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}

export class CreateGrnDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  grnNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  grnDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  post?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [GrnLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnLineInputDto)
  items!: GrnLineInputDto[];
}

export class UpdateGrnDto extends CreateGrnDto {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}

export class CreatePurchaseInvoiceDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ enum: ['DIRECT', 'AGAINST_PO_GRN'], default: 'DIRECT' })
  @IsIn(['DIRECT', 'AGAINST_PO_GRN'])
  mode!: 'DIRECT' | 'AGAINST_PO_GRN';

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  grnIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ example: 'SUP-INV-001' })
  @IsString()
  @IsNotEmpty()
  supplierBillNumber!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ default: 'INR' })
  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  pricesIncludeTax?: boolean;

  @ApiPropertyOptional({ enum: ['PERCENT', 'AMOUNT'] })
  @IsIn(['PERCENT', 'AMOUNT'])
  @IsOptional()
  invoiceDiscountType?: 'PERCENT' | 'AMOUNT';

  @ApiPropertyOptional()
  @IsOptional()
  invoiceDiscountValue?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  roundOff?: string | number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  post?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiProperty({ type: [PurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  items!: PurchaseLineDto[];

  @ApiPropertyOptional({ type: [PurchaseChargeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseChargeDto)
  @IsOptional()
  charges?: PurchaseChargeDto[];
}

export class UpdatePurchaseInvoiceDto extends CreatePurchaseInvoiceDto {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}

export class PurchaseReturnLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  itemName?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  invoiceItemId?: string;

  @ApiProperty({ example: '2' })
  @IsNotEmpty()
  quantity!: string | number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty()
  @IsUUID()
  purchaseInvoiceId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  returnNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ type: [PurchaseReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  items!: PurchaseReturnLineDto[];
}

export class PaymentAllocationDto {
  @ApiProperty()
  @IsUUID()
  purchaseInvoiceId!: string;

  @ApiProperty({ example: '500' })
  @IsNotEmpty()
  amount!: string | number;
}

export class CreatePurchasePaymentDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional({ enum: ['BILL_PAYMENT', 'ADVANCE'], default: 'BILL_PAYMENT' })
  @IsIn(['BILL_PAYMENT', 'ADVANCE'])
  @IsOptional()
  paymentType?: 'BILL_PAYMENT' | 'ADVANCE';

  @ApiPropertyOptional({ enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'], default: 'BANK_TRANSFER' })
  @IsIn(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'])
  @IsOptional()
  mode?: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';

  @ApiProperty({ example: '1000' })
  @IsNotEmpty()
  amount!: string | number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: [PaymentAllocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  @IsOptional()
  allocations?: PaymentAllocationDto[];
}

export class AdjustAdvancePaymentDto {
  @ApiProperty({ type: [PaymentAllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations!: PaymentAllocationDto[];
}

export class CancelReasonDto {
  @ApiProperty({ example: 'Entered in error' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApprovalActionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  delegatedToId?: string;
}

export class CreateApprovalRuleDto {
  @ApiProperty({ enum: ['PR', 'PO', 'INVOICE', 'RETURN'] })
  @IsIn(['PR', 'PO', 'INVOICE', 'RETURN'])
  documentType!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiProperty({ example: [{ level: 1, roleName: 'MANAGER', userIds: [] }] })
  @IsArray()
  @ArrayMinSize(1)
  levels!: Array<{ level: number; roleName?: string; userIds?: string[] }>;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePurchaseSettingsDto {
  @ApiPropertyOptional({ enum: ['GST', 'VAT'] })
  @IsIn(['GST', 'VAT'])
  @IsOptional()
  taxRegime?: 'GST' | 'VAT';

  @ApiPropertyOptional({ enum: ['WAC', 'FIFO'] })
  @IsIn(['WAC', 'FIFO'])
  @IsOptional()
  costingMethod?: 'WAC' | 'FIFO';

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableGrnAccrual?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  blockReturnOnInsufficientStock?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultOverReceiptTolerance?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttachmentSizeMb?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  accountsPayableAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inventoryAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  grnClearingAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  priceVarianceAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  discountReceivedAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  freightAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  otherChargesAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inputCgstAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inputSgstAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inputIgstAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  inputVatAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierAdvanceAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  defaultBankAccountId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  defaultCashAccountId?: string;
}
