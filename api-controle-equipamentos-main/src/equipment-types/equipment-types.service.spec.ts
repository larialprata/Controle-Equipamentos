import { BadRequestException } from '@nestjs/common';
import { EquipmentTypesService } from './equipment-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EquipmentTypesService', () => {
  let service: EquipmentTypesService;
  let prisma: {
    equipment_types: { findMany: jest.Mock; findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      equipment_types: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new EquipmentTypesService(prisma as unknown as PrismaService);
  });

  it('findAll deve listar tipos ativos ordenados por nome', async () => {
    const rows = [{ id: 't-1', name: 'Escavadeira' }];
    prisma.equipment_types.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(prisma.equipment_types.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual(rows);
  });

  it('findOne deve retornar tipo quando existe', async () => {
    prisma.equipment_types.findFirst.mockResolvedValue({ id: 't-1' });

    const result = await service.findOne('t-1');

    expect(prisma.equipment_types.findFirst).toHaveBeenCalledWith({
      where: { id: 't-1', active: true },
    });
    expect(result).toEqual({ id: 't-1' });
  });

  it('findOne deve lançar erro quando tipo não existe', async () => {
    prisma.equipment_types.findFirst.mockResolvedValue(null);
    await expect(service.findOne('t-404')).rejects.toBeInstanceOf(BadRequestException);
  });
});
