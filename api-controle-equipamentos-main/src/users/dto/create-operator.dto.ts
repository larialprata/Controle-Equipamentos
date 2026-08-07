import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOperatorDto {
  @ApiProperty({ description: 'Nome completo do operador', example: 'João da Silva' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name: string;

  @ApiPropertyOptional({ description: 'E-mail do operador', example: 'operador@exemplo.com', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(255)
  email?: string | null;

  @ApiProperty({ description: 'CPF do operador', example: '12345678900' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D+/g, '') : value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos numéricos' })
  cpf: string;

  @ApiProperty({ description: 'Senha de acesso do operador', minLength: 6, example: 'senha123' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ description: 'Contrato vinculado ao operador', nullable: true })
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
  @IsUUID()
  contract_id?: string | null;
}
