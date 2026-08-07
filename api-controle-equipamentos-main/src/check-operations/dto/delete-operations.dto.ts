import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteOperationsDto {
  @ApiProperty({
    description: 'IDs das operações a excluir (selecionadas no BI)',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Envie ao menos um ID para excluir' })
  ids: string[];
}
