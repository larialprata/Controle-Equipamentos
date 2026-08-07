import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const SALT_ROUNDS = 10;

export type UserWithoutPassword = {
  id: string;
  full_name: string;
  phone: string | null;
  cpf: string;
  email: string | null;
  address: string | null;
  cnh_photo: string | null;
  is_active: boolean;
  is_admin: boolean;
  contract_id?: string | null;
  equipment_type_id?: string | null;
  ativo_placa?: string | null;
  qr_payload?: string | null;
  created_at: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, cnhPhotoUrl: string): Promise<UserWithoutPassword> {
    const existingByEmail = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (existingByEmail) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    const existingByCpf = await this.prisma.users.findUnique({
      where: { cpf: dto.cpf },
    });
    if (existingByCpf) {
      throw new ConflictException('Já existe um usuário cadastrado com este CPF');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.users.create({
      data: {
        full_name: dto.full_name,
        phone: dto.phone,
        cpf: dto.cpf,
        email: dto.email,
        address: dto.address,
        equipment_type_id: dto.equipment_type_id ?? null,
        password: hashedPassword,
        cnh_photo: cnhPhotoUrl,
        is_active: false,
      },
    });

    return this.toUserWithoutPassword(user);
  }

  async validateUser(
    identifier: string,
    password: string,
  ): Promise<UserWithoutPassword> {
    const normalizedIdentifier = identifier.trim();
    const cpfOnly = normalizedIdentifier.replace(/\D+/g, '');

    const user = await this.prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedIdentifier, mode: 'insensitive' } },
          { full_name: { equals: normalizedIdentifier, mode: 'insensitive' } },
          ...(cpfOnly.length === 11 ? [{ cpf: cpfOnly }] : []),
        ],
      },
      select: {
        id: true,
        full_name: true,
        phone: true,
        cpf: true,
        email: true,
        address: true,
        password: true,
        cnh_photo: true,
        is_active: true,
        is_admin: true,
        contract_id: true,
        equipment_type_id: true,
        ativo_placa: true,
        qr_payload: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.is_active) {
      throw new UnauthorizedException(
        'Usuário inativo. Entre em contato com o administrador.',
      );
    }

    return this.toUserWithoutPassword(user);
  }

  async login(user: UserWithoutPassword) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? '',
      is_admin: user.is_admin,
      full_name: user.full_name,
      cpf: user.cpf,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        cpf: user.cpf,
        full_name: user.full_name,
        name: user.full_name,
        is_admin: user.is_admin,
        is_active: user.is_active,
        contract_id: user.contract_id ?? null,
        equipment_type_id: user.equipment_type_id ?? null,
        ativo_placa: user.ativo_placa ?? null,
        qr_payload: user.qr_payload ?? null,
      },
      // Nome na raiz também, para o app encontrar em data.name ou data.full_name
      name: user.full_name,
      full_name: user.full_name,
    };
  }

  private toUserWithoutPassword(user: {
    id: string;
    full_name: string;
    phone: string | null;
    cpf: string;
    email: string | null;
    address: string | null;
    cnh_photo: string | null;
    is_active: boolean;
    is_admin: boolean;
    contract_id?: string | null;
    equipment_type_id?: string | null;
    ativo_placa?: string | null;
    qr_payload?: string | null;
    created_at: Date;
  }): UserWithoutPassword {
    return {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      cpf: user.cpf,
      email: user.email,
      address: user.address,
      cnh_photo: user.cnh_photo,
      is_active: user.is_active,
      is_admin: user.is_admin,
      contract_id: user.contract_id ?? null,
      equipment_type_id: user.equipment_type_id ?? null,
      ativo_placa: user.ativo_placa ?? null,
      qr_payload: user.qr_payload ?? null,
      created_at: user.created_at,
    };
  }
}
