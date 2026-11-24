import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Raj', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Kumar', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+91 9876543212', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: ['role-accountant'], required: false })
  @IsArray()
  @IsOptional()
  roleIds?: string[];

  @ApiProperty({ example: ['branch-id-1'], required: false })
  @IsArray()
  @IsOptional()
  branchIds?: string[];

  @ApiProperty({ example: 'manager-user-id', required: false })
  @IsString()
  @IsOptional()
  reportsToId?: string;

  @ApiProperty({ example: 'Engineering', required: false })
  @IsString()
  @IsOptional()
  team?: string;

  @ApiProperty({ example: 'Developer', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ example: 'EMPLOYEE', enum: ['MANAGER', 'EMPLOYEE'], required: false })
  @IsString()
  @IsOptional()
  memberType?: string;

  @ApiProperty({ example: 'ACTIVE', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2024-01-15', required: false })
  @IsString()
  @IsOptional()
  joiningDate?: string;
}
