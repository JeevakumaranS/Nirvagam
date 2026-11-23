import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { InvoiceType } from '@nirvagam/shared';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'variant-id' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity!: number;

  @ApiProperty({ example: 899.0 })
  @IsNumber()
  unitPrice!: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 18.0 })
  @IsNumber()
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

  @ApiProperty({ example: '2026-11-20', required: false })
  @IsString()
  @IsOptional()
  invoiceDate?: string;

  @ApiProperty({ example: '2026-12-20', required: false })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 'Thank you for your business.', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 'Standard commercial sales terms apply.', required: false })
  @IsString()
  @IsOptional()
  terms?: string;
}
