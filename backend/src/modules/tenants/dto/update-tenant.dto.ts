import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @ApiProperty({ example: 'Durozen Technologies Pvt Ltd' })
  @IsString()
  @IsOptional()
  name?: string;
}
