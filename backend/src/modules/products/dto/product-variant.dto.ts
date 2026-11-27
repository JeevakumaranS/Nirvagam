import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ProductVariantDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsObject()
  attributes!: Record<string, string>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  mrp?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  retailPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockLevel?: number;

  @IsString()
  @IsOptional()
  taxRateId?: string;

  @IsBoolean()
  @IsOptional()
  isTaxInclusive?: boolean;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
