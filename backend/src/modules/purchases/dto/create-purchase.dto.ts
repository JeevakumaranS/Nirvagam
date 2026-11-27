import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreatePurchaseItemDto {
  @ApiProperty({ example: 'variant-id' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  quantity!: number;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  unitPrice!: number;

  @ApiProperty({ example: 18.0 })
  @IsNumber()
  gstRate!: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'supplier-id' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({ example: 'BILL-SRI-2026-081' })
  @IsString()
  @IsNotEmpty()
  billNumber!: string;

  @ApiProperty({ example: '2026-11-20', required: false })
  @IsString()
  @IsOptional()
  billDate?: string;

  @ApiProperty({ example: '2026-12-20', required: false })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
