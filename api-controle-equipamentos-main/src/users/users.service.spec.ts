import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    users: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    contracts: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      users: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      contracts: { findUnique: jest.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('findAll deve listar usuários sem senha', async () => {
    prisma.users.findMany.mockResolvedValue([{ id: 'u-1', contract: null }]);
    const result = await service.findAll();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'u-1',
        contract: null,
        equipment_type: null,
      }),
    ]);
  });

  it('findOne deve lançar erro quando usuário não existe', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    await expect(service.findOne('u-404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toggleUserStatus deve inverter is_active', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'u-1', is_active: true });
    prisma.users.update.mockResolvedValue({
      id: 'u-1',
      full_name: 'Nome',
      phone: '119',
      cpf: '123',
      email: 'a@a.com',
      address: 'Rua',
      cnh_photo: '/x',
      is_active: false,
      is_admin: false,
      contract_id: null,
      created_at: new Date(),
    });
    const result = await service.toggleUserStatus('u-1');
    expect(result.is_active).toBe(false);
  });

  it('updateUser deve validar contrato quando enviado', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'u-1' });
    prisma.contracts.findUnique.mockResolvedValue(null);
    await expect(service.updateUser('u-1', { contract_id: 'c-404' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
