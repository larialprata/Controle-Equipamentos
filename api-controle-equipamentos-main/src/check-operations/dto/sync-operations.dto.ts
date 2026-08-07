import { IsArray, ValidateNested, IsEnum, IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OperationType } from '@prisma/client';

class OfflineOperationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contract_id: string;

  @ApiProperty({ description: 'ID do tipo de equipamento (equipment_types)' })
  @IsString()
  @IsNotEmpty()
  equipment_type_id: string;

  @ApiProperty({ description: 'Ativo ou placa digitado pelo usuário (texto livre)' })
  @IsString()
  @IsNotEmpty()
  ativo_placa: string;

  @ApiProperty({ enum: ['checkin', 'checkout'] })
  @IsEnum(['checkin', 'checkout'])
  @IsNotEmpty()
  operation_type: OperationType;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  horimeter: number;

  @ApiProperty({ description: 'Base64 encoded photo' })
  @IsString()
  @IsNotEmpty()
  photo_base64: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty()
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

export class SyncOperationsDto {
  @ApiProperty({ type: [OfflineOperationDto], description: 'Array of queued operations to sync' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineOperationDto)
  operations: OfflineOperationDto[];
}
