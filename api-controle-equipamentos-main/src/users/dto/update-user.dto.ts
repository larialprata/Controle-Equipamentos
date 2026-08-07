import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Permissão de administrador' })
  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;

  @ApiPropertyOptional({ description: 'Usuário ativo (pode fazer login)' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'E-mail do usuário (null para remover)', nullable: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
        return null;
      }
      return normalized;
    }
    return value;
  })
  @ValidateIf((_, v) => v != null)
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ description: 'ID do contrato para vincular o usuário (null para desvincular)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
        return null;
      }
      return value.trim();
    }
    return value;
  })
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  contract_id?: string | null;

  @ApiPropertyOptional({ description: 'ID do tipo de equipamento vinculado ao usuário (compatibilidade app novo)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
        return null;
      }
      return value.trim();
    }
    return value;
  })
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  equipment_type_id?: string | null;

  @ApiPropertyOptional({ description: 'Ativo/placa vinculado ao usuário (compatibilidade app novo)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
        return null;
      }
      return value.trim().toUpperCase().replace(/\s/g, '');
    }
    return value;
  })
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(50)
  ativo_placa?: string | null;

  @ApiPropertyOptional({ description: 'Regenera manualmente o QR do usuário' })
  @IsOptional()
  @IsBoolean()
  reload_qr?: boolean;
}
