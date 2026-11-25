import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  IsObject,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BusinessType, IndustryType } from '@nirvagam/shared';
import { BusinessBranchDto } from './business-branch.dto';

export const SUPPORTED_BUSINESS_MODULES = [
  'sales',
  'purchases',
  'inventory',
  'accounting',
  'pos',
  'gst',
  'reports',
  'crm',
] as const;

export class SaveBusinessProfileDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tradeName!: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @ApiProperty({ enum: IndustryType })
  @IsEnum(IndustryType)
  industry!: IndustryType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(15)
  gstin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10)
  pan?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  stateCode!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(150)
  jurisdiction?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  pincode!: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  financialYearStart!: string;

  @ApiProperty({ example: '2027-03-31' })
  @IsDateString()
  financialYearEnd!: string;

  @ApiProperty({ example: 'INV-' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  invoicePrefix!: string;

  @ApiProperty({ example: 'INR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency!: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  taxSettings?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsIn(SUPPORTED_BUSINESS_MODULES, { each: true })
  @IsOptional()
  enabledModules?: string[];

  @ApiPropertyOptional({ maxLength: 1400000 })
  @IsString()
  @MaxLength(1400000)
  @IsOptional()
  logoUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 1400000 })
  @IsString()
  @MaxLength(1400000)
  @IsOptional()
  digitalSignatureUrl?: string | null;

  @ApiPropertyOptional({ type: [BusinessBranchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessBranchDto)
  @IsOptional()
  branches?: BusinessBranchDto[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  planId?: string | null;

  @ApiPropertyOptional({ description: 'Owner login username (email address)' })
  @IsEmail()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'Business owner full name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  ownerName?: string;

  @ApiPropertyOptional({ minLength: 8, description: 'One-time password for owner account creation or reset' })
  @IsString()
  @MinLength(8)
  @IsOptional()
  temporaryPassword?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  requirePasswordChange?: boolean;
}
