import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateContractStatusDto {
  @ApiProperty({ description: 'Status ativo do contrato', example: false })
  @IsBoolean()
  active: boolean;
}
