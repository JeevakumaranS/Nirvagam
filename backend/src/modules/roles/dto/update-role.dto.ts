import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ example: 'Warehouse Supervisor', required: false })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'Manage stock counts and warehouse operations', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;
}
