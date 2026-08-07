import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({ example: '229 - ECO Barreira', description: 'Nome do contrato' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}
