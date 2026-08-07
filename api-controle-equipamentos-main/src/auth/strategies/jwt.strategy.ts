import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  is_admin: boolean;
  full_name?: string;
  cpf?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('JWT_SECRET')?.trim();
        if (!secret) {
          throw new Error('JWT_SECRET must be set');
        }
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        full_name: true,
        phone: true,
        cpf: true,
        email: true,
        address: true,
        cnh_photo: true,
        is_active: true,
        is_admin: true,
        contract_id: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Usuário inativo');
    }

    return user;
  }
}
