import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsIn(['WHOLE', 'DECIMAL'])
  @IsOptional()
  quantityType?: 'WHOLE' | 'DECIMAL';

  @IsString()
  @IsOptional()
  uqcCode?: string;
}

export class UpdateUnitDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  symbol?: string;

  @IsIn(['WHOLE', 'DECIMAL'])
  @IsOptional()
  quantityType?: 'WHOLE' | 'DECIMAL';

  @IsString()
  @IsOptional()
  uqcCode?: string;
}
