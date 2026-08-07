import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findAll: jest.Mock;
    updateUser: jest.Mock;
    toggleUserStatus: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findAll: jest.fn(),
      updateUser: jest.fn(),
      toggleUserStatus: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('listUsers deve retornar mensagem e lista', async () => {
    usersService.findAll.mockResolvedValue([{ id: 'u-1' }]);
    const result = await controller.listUsers();
    expect(result).toEqual({ message: 'Lista de usuários', users: [{ id: 'u-1' }] });
  });

  it('getDocumentPhoto deve validar filename', async () => {
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), sendFile: jest.fn() };
    const req = { user: { id: 'u-1', is_admin: false, cnh_photo: '/uploads/documents/uuid.jpg' } };
    await expect(controller.getDocumentPhoto(req as never, '../bad', res as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getDocumentPhoto deve negar arquivo que não é da CNH do usuário', async () => {
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), sendFile: jest.fn() };
    const req = { user: { id: 'u-1', is_admin: false, cnh_photo: '/uploads/documents/meu-arquivo.jpg' } };
    await expect(
      controller.getDocumentPhoto(req as never, 'outro.jpg', res as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateUser deve retornar resposta padronizada', async () => {
    usersService.updateUser.mockResolvedValue({ message: 'ok', user: { id: 'u-1' } });
    const result = await controller.updateUser('u-1', { is_admin: true });
    expect(result).toEqual({ message: 'ok', user: { id: 'u-1' } });
  });

  it('getUser deve retornar usuário', async () => {
    usersService.findOne.mockResolvedValue({ id: 'u-1' });
    const result = await controller.getUser('u-1');
    expect(result).toEqual({ message: 'Usuário encontrado', user: { id: 'u-1' } });
  });
});
