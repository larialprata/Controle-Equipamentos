import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMunicipalityDto {
  @ApiProperty({ example: 'Rio de Janeiro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'UUID da obra à qual o município pertence' })
  @IsUUID()
  obra_id: string;
}
