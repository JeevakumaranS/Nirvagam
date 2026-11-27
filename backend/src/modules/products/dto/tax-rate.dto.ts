import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTaxRateDto {
  @ApiProperty({ example: 'GST 5%' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 5, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;
}

export class UpdateTaxRateDto {
  @ApiPropertyOptional({ example: 'GST 5%' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 5, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  rate?: number;
}
