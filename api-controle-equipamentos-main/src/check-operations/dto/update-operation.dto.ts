import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateOperationDto {
  @ApiPropertyOptional({ description: 'Operation datetime in ISO format' })
  @IsDateString()
  @IsOptional()
  operation_datetime?: string;

  @ApiPropertyOptional({ description: 'Equipment horimeter reading' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  horimeter?: number;

  @ApiPropertyOptional({ description: 'Optional observation/notes' })
  @IsString()
  @IsOptional()
  observation?: string;
}
