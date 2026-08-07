import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEquipmentDto {
  @ApiProperty({ description: 'Nome de exibição do equipamento', example: 'Escavadeira principal' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Contrato vinculado', example: 'uuid-do-contrato' })
  @IsUUID()
  contract_id: string;

  @ApiPropertyOptional({ description: 'Obra vinculada', example: 'uuid-da-obra' })
  @IsOptional()
  @IsUUID()
  obra_id?: string;

  @ApiProperty({ description: 'Tipo de equipamento', example: 'uuid-do-tipo' })
  @IsUUID()
  equipment_type_id: string;

  @ApiProperty({ description: 'Empresa à qual o equipamento pertence', example: 'Locadora XYZ' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company_name: string;

  @ApiProperty({ description: 'Ativo ou placa do equipamento', example: 'RJX1234' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ativo_placa: string;

  @ApiPropertyOptional({ description: 'Registro ativo', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
