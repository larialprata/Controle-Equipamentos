import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: {
    contracts: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    users: {
      findUnique: jest.Mock;
    };
    obras: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      contracts: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      users: {
        findUnique: jest.fn(),
      },
      obras: {
        findMany: jest.fn(),
      },
    };

    service = new ContractsService(prisma as unknown as PrismaService);
  });

  it('findAllActive deve listar contratos ativos ordenados', async () => {
    const contracts = [{ id: 'c-1', active: true }];
    prisma.contracts.findMany.mockResolvedValue(contracts);

    const result = await service.findAllActive();

    expect(prisma.contracts.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toEqual(contracts);
  });

  it('findMyContract deve retornar null quando usuário não tem contrato', async () => {
    prisma.users.findUnique.mockResolvedValue({ contract_id: null });

    const result = await service.findMyContract('user-1');

    expect(result).toBeNull();
    expect(prisma.contracts.findFirst).not.toHaveBeenCalled();
  });

  it('create deve cadastrar contrato normalizado', async () => {
    const created = { id: 'c-2', name: 'Contrato novo', active: true };
    prisma.contracts.findFirst.mockResolvedValue(null);
    prisma.contracts.create.mockResolvedValue(created);

    const result = await service.create({ name: '  Contrato novo  ' });

    expect(prisma.contracts.findFirst).toHaveBeenCalledWith({
      where: {
        name: {
          equals: 'Contrato novo',
          mode: 'insensitive',
        },
      },
    });
    expect(prisma.contracts.create).toHaveBeenCalledWith({
      data: {
        name: 'Contrato novo',
        active: true,
      },
    });
    expect(result).toEqual(created);
  });

  it('create deve rejeitar contrato duplicado', async () => {
    prisma.contracts.findFirst.mockResolvedValue({ id: 'c-1', name: 'Contrato existente' });

    await expect(service.create({ name: 'Contrato existente' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.contracts.create).not.toHaveBeenCalled();
  });

  it('findMyContract deve retornar contrato quando usuário tem vínculo', async () => {
    const contract = { id: 'c-1', active: true };
    prisma.users.findUnique.mockResolvedValue({ contract_id: 'c-1' });
    prisma.contracts.findFirst.mockResolvedValue(contract);

    const result = await service.findMyContract('user-1');

    expect(prisma.contracts.findFirst).toHaveBeenCalledWith({
      where: { id: 'c-1', active: true },
    });
    expect(result).toEqual(contract);
  });

  it('findObrasByContract deve lançar erro se contrato não existe', async () => {
    prisma.contracts.findUnique.mockResolvedValue(null);

    await expect(service.findObrasByContract('c-404')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.obras.findMany).not.toHaveBeenCalled();
  });

  it('findObrasByContract deve retornar obras ativas ordenadas por código', async () => {
    const obras = [{ id: 'o-1', contract_id: 'c-1' }];
    prisma.contracts.findUnique.mockResolvedValue({ id: 'c-1' });
    prisma.obras.findMany.mockResolvedValue(obras);

    const result = await service.findObrasByContract('c-1');

    expect(prisma.obras.findMany).toHaveBeenCalledWith({
      where: { contract_id: 'c-1', active: true },
      orderBy: { code: 'asc' },
    });
    expect(result).toEqual(obras);
  });
});
