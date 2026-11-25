import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Sree Textiles Mills' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'Sree Mills India Ltd' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: 'contact@sreemills.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '9789012345' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  @Matches(/^\d{10}$/)
  phone!: string;

  @ApiProperty({ example: '33AABCS5432G1Z1', required: false })
  @IsString()
  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @Length(15, 15)
  @Matches(/^[A-Z0-9]{15}$/i)
  gstin?: string;

  @ApiProperty({ example: 'AABCS5432G', required: false })
  @IsString()
  @IsOptional()
  pan?: string;

  @ApiProperty({ example: 'Tirupur Ring Road', required: false })
  @IsString()
  @IsOptional()
  addressStreet?: string;

  @ApiProperty({ example: 'Tirupur', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  city?: string;

  @ApiProperty({ example: 'Tamil Nadu', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '33', required: false })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiProperty({ example: '641604', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  openingBalance?: number;
}
