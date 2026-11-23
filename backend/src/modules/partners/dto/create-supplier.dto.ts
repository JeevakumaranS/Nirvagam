import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Sree Textiles Mills' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Sree Mills India Ltd', required: false })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ example: 'contact@sreemills.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+91 9789012345' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '33AABCS5432G1Z1', required: false })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiProperty({ example: 'AABCS5432G', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ example: 'Tirupur Ring Road' })
  @IsString()
  @IsNotEmpty()
  addressStreet!: string;

  @ApiProperty({ example: 'Tirupur' })
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

  @ApiProperty({ example: '641604' })
  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @ApiProperty({ example: 45, required: false })
  @IsNumber()
  @IsOptional()
  creditPeriodDays?: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  openingBalance?: number;
}
