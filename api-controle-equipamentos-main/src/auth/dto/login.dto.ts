import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Nome completo, CPF ou e-mail do usuário', example: 'João da Silva' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'User password', example: 'secret' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

