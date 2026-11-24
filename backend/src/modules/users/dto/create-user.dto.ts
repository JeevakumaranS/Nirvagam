import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Raj' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Kumar' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+91 9876543212', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: ['role-accountant'], description: 'List of role IDs' })
  @IsArray()
  roleIds!: string[];

  @ApiProperty({ example: ['branch-id-1'], description: 'List of assigned branch IDs' })
  @IsArray()
  branchIds!: string[];

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

  @ApiProperty({ example: 'EMPLOYEE', enum: ['OWNER', 'MANAGER', 'EMPLOYEE'], required: false })
  @IsString()
  @IsIn(['OWNER', 'MANAGER', 'EMPLOYEE'])
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
