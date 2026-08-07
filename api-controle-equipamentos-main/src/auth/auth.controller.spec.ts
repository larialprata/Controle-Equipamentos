import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { validateUser: jest.Mock; login: jest.Mock; register: jest.Mock };
  let usersService: { updateUser: jest.Mock };

  beforeEach(() => {
    authService = { validateUser: jest.fn(), login: jest.fn(), register: jest.fn() };
    usersService = { updateUser: jest.fn() };
    controller = new AuthController(
      authService as unknown as AuthService,
      { isConfigured: jest.fn().mockReturnValue(true), uploadCnh: jest.fn().mockResolvedValue('/url') } as unknown as StorageService,
      usersService as unknown as UsersService,
    );
  });

  it('login deve validar usuário e retornar token', async () => {
    authService.validateUser.mockResolvedValue({ id: 'u-1' });
    authService.login.mockResolvedValue({ access_token: 't', user: { id: 'u-1' } });

    const result = await controller.login({ identifier: 'a@a.com', password: '123' } as any);

    expect(authService.validateUser).toHaveBeenCalledWith('a@a.com', '123');
    expect(result).toEqual({ message: 'Authenticated', access_token: 't', user: { id: 'u-1' } });
  });

  it('me deve retornar dados mínimos do usuário', () => {
    expect(controller.me({ email: 'a@a.com', full_name: 'Nome' })).toEqual({
      user: { email: 'a@a.com', full_name: 'Nome' },
    });
  });

  it('register deve falhar sem foto', async () => {
    await expect(
      controller.register(
        {
          full_name: 'Nome',
          phone: '119',
          cpf: '12345678900',
          email: 'a@a.com',
          address: 'Rua',
          password: '123456',
        },
        undefined as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateUser deve delegar para usersService', async () => {
    usersService.updateUser.mockResolvedValue({ message: 'ok', user: { id: 'u-1' } });
    const result = await controller.updateUser('u-1', { is_admin: true });
    expect(result).toEqual({ message: 'ok', user: { id: 'u-1' } });
  });
});
