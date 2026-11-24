import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceType, PaymentMode, RecurrenceFrequency } from '@nirvagam/shared';

const RECEIPT_PAYMENT_MODES = [
  PaymentMode.CASH,
  PaymentMode.BANK_TRANSFER,
  PaymentMode.UPI,
  PaymentMode.CARD,
  PaymentMode.CHEQUE,
];

export class CreateInvoicePaymentDto {
  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: RECEIPT_PAYMENT_MODES })
  @IsIn(RECEIPT_PAYMENT_MODES)
  mode!: Exclude<PaymentMode, PaymentMode.CREDIT>;

  @ApiProperty({ example: '2026-11-23', required: false })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reference?: string;
}

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'variant-id' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unitName?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ example: 899.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 18.0 })
  @IsNumber()
  @Min(0)
  gstRate!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'customer-id' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ enum: InvoiceType, default: InvoiceType.TAX_INVOICE })
  @IsEnum(InvoiceType)
  @IsOptional()
  invoiceType?: InvoiceType;

  @ApiProperty({ required: false, description: 'Manual invoice number; requires manual-number permission.' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({ required: false, description: 'Original invoice for a credit note, debit note, or sales return.' })
  @IsString()
  @IsOptional()
  relatedInvoiceId?: string;

  @ApiProperty({ enum: RecurrenceFrequency, required: false })
  @IsEnum(RecurrenceFrequency)
  @IsOptional()
  recurrenceFrequency?: RecurrenceFrequency;

  @ApiProperty({ example: '2026-11-20', required: false })
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @ApiProperty({ example: '2026-12-20', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  pricesIncludeTax?: boolean;

  @ApiProperty({ example: '33', required: false })
  @IsString()
  @IsOptional()
  placeOfSupplyCode?: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  additionalCharges?: number;

  @ApiProperty({ type: [CreateInvoicePaymentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoicePaymentDto)
  @IsOptional()
  payments?: CreateInvoicePaymentDto[];

  @ApiProperty({ example: 'Thank you for your business.', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 'Standard commercial sales terms apply.', required: false })
  @IsString()
  @IsOptional()
  terms?: string;
}
