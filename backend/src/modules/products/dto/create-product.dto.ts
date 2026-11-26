import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Cotton Formal Shirt' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'SHIRT-CFS-01' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: '8901234567890', required: false })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: '6205', required: false })
  @IsString()
  @IsOptional()
  hsnCode?: string;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  purchasePrice!: number;

  @ApiProperty({ example: 899.0 })
  @IsNumber()
  @IsOptional()
  salesPrice!: number;

  @ApiProperty({ example: 999.0, required: false })
  @IsNumber()
  @IsOptional()
  mrp?: number;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  minStockLevel?: number;

  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @IsOptional()
  openingStock?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isTaxInclusive?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  taxRateId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  wholesalePrice?: number;

  @IsNumber()
  @IsOptional()
  retailPrice?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  trackingMode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
