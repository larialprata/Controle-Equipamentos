import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MunicipalitiesService } from './municipalities.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MunicipalitiesService', () => {
  let service: MunicipalitiesService;
  let prisma: {
    obras: { findFirst: jest.Mock };
    municipalities: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      obras: { findFirst: jest.fn() },
      municipalities: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new MunicipalitiesService(prisma as unknown as PrismaService);
  });

  it('findByObra deve lançar erro quando obra não existe', async () => {
    prisma.obras.findFirst.mockResolvedValue(null);
    await expect(service.findByObra('o-404')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findByObra deve listar municípios ativos da obra', async () => {
    prisma.obras.findFirst.mockResolvedValue({ id: 'o-1' });
    prisma.municipalities.findMany.mockResolvedValue([{ id: 'm-1' }]);

    const result = await service.findByObra('o-1');

    expect(prisma.municipalities.findMany).toHaveBeenCalledWith({
      where: { obra_id: 'o-1', active: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: 'm-1' }]);
  });

  it('findOne deve lançar erro quando município não existe', async () => {
    prisma.municipalities.findUnique.mockResolvedValue(null);
    await expect(service.findOne('m-404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create deve criar município com nome trimado', async () => {
    prisma.obras.findFirst.mockResolvedValue({ id: 'o-1' });
    prisma.municipalities.create.mockResolvedValue({ id: 'm-1', name: 'Cidade', obra: { id: 'o-1', code: '242' } });

    const result = await service.create({ name: '  Cidade  ', obra_id: 'o-1' });

    expect(prisma.municipalities.create).toHaveBeenCalledWith({
      data: { name: 'Cidade', obra_id: 'o-1' },
      include: { obra: { select: { id: true, code: true } } },
    });
    expect(result).toEqual({ id: 'm-1', name: 'Cidade', obra: { id: 'o-1', code: '242' } });
  });

  it('update deve atualizar município existente', async () => {
    prisma.municipalities.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.municipalities.update.mockResolvedValue({ id: 'm-1', name: 'Novo' });

    const result = await service.update('m-1', { name: '  Novo  ', active: true });

    expect(prisma.municipalities.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { name: 'Novo', active: true },
      include: { obra: { select: { id: true, code: true } } },
    });
    expect(result).toEqual({ id: 'm-1', name: 'Novo' });
  });
});
