import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Kavitha Silks & Textiles' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'Kavitha Silks Pvt Ltd', required: false })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ example: 'kavitha@example.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '9842109876' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  @Matches(/^\d{10}$/)
  phone!: string;

  @ApiProperty({ example: '33AABCK1234F1Z9', required: false })
  @IsString()
  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @Length(15, 15)
  @Matches(/^[A-Z0-9]{15}$/i)
  gstin?: string;

  @ApiProperty({ example: 'AABCK1234F', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ example: 'Cross Cut Road', required: false })
  @IsString()
  @IsOptional()
  billingStreet?: string;

  @ApiProperty({ example: 'Coimbatore', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  billingCity?: string;

  @ApiProperty({ example: 'Tamil Nadu', required: false })
  @IsString()
  @IsOptional()
  billingState?: string;

  @ApiProperty({ example: '33', required: false })
  @IsString()
  @IsOptional()
  billingStateCode?: string;

  @ApiProperty({ example: '641012', required: false })
  @IsString()
  @IsOptional()
  billingPincode?: string;

  @ApiProperty({ example: 100000.0, required: false })
  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @ApiProperty({ example: 30, required: false })
  @IsNumber()
  @IsOptional()
  creditPeriodDays?: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  openingBalance?: number;
}
