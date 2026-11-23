import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateJournalLineDto {
  @ApiProperty({ example: 'account-id' })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: 5000.0 })
  @IsNumber()
  debit!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  credit!: number;

  @ApiProperty({ example: 'Rent payment for Nov 2026', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateJournalDto {
  @ApiProperty({ example: 'Office Rent & Utilities Payment' })
  @IsString()
  @IsNotEmpty()
  narration!: string;

  @ApiProperty({ example: '2026-11-20', required: false })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: 'CHEQUE-998811', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ type: [CreateJournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
