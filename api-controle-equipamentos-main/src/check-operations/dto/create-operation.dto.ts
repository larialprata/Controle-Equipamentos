import { IsEnum, IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OperationType } from '@prisma/client';

export class CreateOperationDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsString()
  @IsNotEmpty()
  contract_id: string;

  @ApiProperty({ description: 'ID do tipo de equipamento (equipment_types). Usuário seleciona na lista.' })
  @IsString()
  @IsNotEmpty()
  equipment_type_id: string;

  @ApiProperty({ description: 'Ativo ou placa digitado pelo usuário (texto livre)' })
  @IsString()
  @IsNotEmpty()
  ativo_placa: string;

  @ApiPropertyOptional({ description: 'ID do equipamento (legado, opcional — vindo do QR)' })
  @IsOptional()
  @IsUUID()
  equipment_id?: string;

  @ApiProperty({ enum: ['checkin', 'checkout'], description: 'Operation type' })
  @IsEnum(['checkin', 'checkout'])
  @IsNotEmpty()
  operation_type: OperationType;

  @ApiProperty({ description: 'Equipment horimeter reading' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  horimeter: number;

  @ApiProperty({ description: 'Latitude coordinate' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: 'Longitude coordinate' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ description: 'Operation datetime in ISO format' })
  @IsDateString()
  @IsNotEmpty()
  operation_datetime: string;

  @ApiProperty({ description: 'Optional observation/notes', required: false })
  @IsString()
  @IsOptional()
  observation?: string;

  @ApiProperty({ description: 'Device ID' })
  @IsString()
  @IsNotEmpty()
  device_id: string;
}
