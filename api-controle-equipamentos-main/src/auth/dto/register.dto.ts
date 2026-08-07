import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Full name', example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name: string;

  @ApiProperty({ description: 'Phone number', example: '11999999999' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ description: 'CPF (numbers only)', example: '12345678900' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos numéricos' })
  cpf: string;

  @ApiProperty({ description: 'E-mail', example: 'usuario@exemplo.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Address', example: 'Rua Exemplo, 123 - Bairro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({ description: 'Password (min 6 characters)', example: 'senha123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ description: 'ID do tipo de equipamento (compatibilidade app novo)' })
  @IsOptional()
  @IsUUID()
  equipment_type_id?: string;
}
