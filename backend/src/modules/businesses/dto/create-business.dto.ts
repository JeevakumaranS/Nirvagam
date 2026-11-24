import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { BusinessType, IndustryType } from '@nirvagam/shared';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Durozen Technologies Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiProperty({ example: 'Nirvagam Retail' })
  @IsString()
  @IsNotEmpty()
  tradeName!: string;

  @ApiProperty({ enum: BusinessType, default: BusinessType.PRIVATE_LIMITED })
  @IsEnum(BusinessType)
  @IsOptional()
  businessType?: BusinessType;

  @ApiProperty({ enum: IndustryType, default: IndustryType.RETAIL })
  @IsEnum(IndustryType)
  @IsOptional()
  industry?: IndustryType;

  @ApiProperty({ example: 'ABCDE1234F', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+91 9876543210', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, type: Object })
  @IsObject()
  @IsOptional()
  taxSettings?: Record<string, boolean>;

  @ApiProperty({ required: false, maxLength: 1400000 })
  @IsString()
  @MaxLength(1400000)
  @IsOptional()
  logoUrl?: string | null;

  @ApiProperty({ required: false, maxLength: 1400000 })
  @IsString()
  @MaxLength(1400000)
  @IsOptional()
  signatureUrl?: string | null;

  @ApiProperty({ example: 'Su. Masan Complex, Second Floor' })
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @ApiProperty({ example: 'Trichy Highways', required: false })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'Namakkal' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: 'Tamil Nadu' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ example: '33' })
  @IsString()
  @IsNotEmpty()
  stateCode!: string;

  @ApiProperty({ example: '637020' })
  @IsString()
  @IsNotEmpty()
  pincode!: string;
}
