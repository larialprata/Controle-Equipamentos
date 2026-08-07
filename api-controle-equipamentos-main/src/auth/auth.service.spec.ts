import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    users: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  beforeEach(() => {
    prisma = {
      users: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    };
    jwtService = { sign: jest.fn().mockReturnValue('token-123') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      {} as ConfigService,
    );
  });

  it('register deve falhar quando email já existe', async () => {
    prisma.users.findUnique.mockResolvedValueOnce({ id: 'u-1' });
    await expect(
      service.register(
        {
          full_name: 'Nome',
          phone: '119',
          cpf: '12345678900',
          email: 'a@a.com',
          address: 'Rua',
          password: '123456',
        },
        '/img.jpg',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validateUser deve falhar quando usuário não existe', async () => {
    prisma.users.findFirst.mockResolvedValue(null);

    await expect(service.validateUser('a@a.com', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login deve gerar token e payload de usuário', async () => {
    const result = await service.login({
      id: 'u-1',
      full_name: 'Nome',
      phone: '119',
      cpf: '12345678900',
      email: 'a@a.com',
      address: 'Rua',
      cnh_photo: '/img.jpg',
      is_active: true,
      is_admin: true,
      created_at: new Date(),
    });

    expect(jwtService.sign).toHaveBeenCalled();
    expect(result.access_token).toBe('token-123');
    expect(result.user.email).toBe('a@a.com');
    expect(result.user.full_name).toBe('Nome');
    expect(result.user.name).toBe('Nome');
  });
});
