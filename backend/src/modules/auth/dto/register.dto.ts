import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { BusinessType, IndustryType } from '@nirvagam/shared';

export class RegisterDto {
  @ApiProperty({ example: 'Durozen Technologies', description: 'Business company name' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: 'durozen', description: 'Unique slug for the workspace' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ example: 'admin@nirvagam.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jeeva' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+91 9876543210', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '33AAAAA0000A1Z5', required: false })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiProperty({ example: 'ABCDE1234F', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ example: 'Tamil Nadu', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '33', required: false })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiProperty({ enum: BusinessType, default: BusinessType.PRIVATE_LIMITED })
  @IsOptional()
  businessType?: BusinessType;

  @ApiProperty({ enum: IndustryType, default: IndustryType.RETAIL })
  @IsOptional()
  industry?: IndustryType;
}
