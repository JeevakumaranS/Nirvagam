import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Kavitha Silks & Textiles' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Kavitha Silks Pvt Ltd', required: false })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ example: 'kavitha@example.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+91 9842109876' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '33AABCK1234F1Z9', required: false })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiProperty({ example: 'AABCK1234F', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ example: 'Cross Cut Road' })
  @IsString()
  @IsNotEmpty()
  billingStreet!: string;

  @ApiProperty({ example: 'Coimbatore' })
  @IsString()
  @IsNotEmpty()
  billingCity!: string;

  @ApiProperty({ example: 'Tamil Nadu' })
  @IsString()
  @IsNotEmpty()
  billingState!: string;

  @ApiProperty({ example: '33' })
  @IsString()
  @IsNotEmpty()
  billingStateCode!: string;

  @ApiProperty({ example: '641012' })
  @IsString()
  @IsNotEmpty()
  billingPincode!: string;

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
