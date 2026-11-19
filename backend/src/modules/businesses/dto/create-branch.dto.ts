import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Chennai Retail Branch' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'CHN' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  isHeadOffice?: boolean;

  @ApiProperty({ example: '33AAAAA0000A1Z5', required: false })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiProperty({ example: '+91 9876543211', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Anna Salai' })
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @ApiProperty({ example: 'Chennai' })
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

  @ApiProperty({ example: '600017' })
  @IsString()
  @IsNotEmpty()
  pincode!: string;
}
