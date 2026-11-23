import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BusinessBranchDto {
  @ApiProperty({ example: 'HQ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Head Office' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isHeadOffice?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(15)
  gstin?: string;

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  pincode!: string;
}
