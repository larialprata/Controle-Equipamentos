import { BadRequestException } from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EquipmentsService', () => {
  let service: EquipmentsService;
  let prisma: {
    equipments: { findMany: jest.Mock };
    contracts: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      equipments: { findMany: jest.fn() },
      contracts: { findUnique: jest.fn() },
    };
    service = new EquipmentsService(prisma as unknown as PrismaService);
  });

  it('findAllActive deve listar equipamentos ativos', async () => {
    prisma.equipments.findMany.mockResolvedValue([{ id: 'e-1' }]);

    const result = await service.findAllActive();

    expect(prisma.equipments.findMany).toHaveBeenCalledWith({
      where: { active: true },
      include: {
        contract: { select: { id: true, name: true } },
        obra: { select: { id: true, code: true, contract_id: true } },
        equipment_type: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toEqual([{ id: 'e-1', qr_code_value: 'e-1' }]);
  });

  it('findByContract deve lançar erro quando contrato não existe', async () => {
    prisma.contracts.findUnique.mockResolvedValue(null);

    await expect(service.findByContract('c-404')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findByContract deve listar ativos do contrato e globais', async () => {
    prisma.contracts.findUnique.mockResolvedValue({ id: 'c-1' });
    prisma.equipments.findMany.mockResolvedValue([{ id: 'e-1' }]);

    const result = await service.findByContract('c-1');

    expect(prisma.equipments.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        contract_id: 'c-1',
      },
      include: {
        contract: { select: { id: true, name: true } },
        obra: { select: { id: true, code: true, contract_id: true } },
        equipment_type: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });
    expect(result).toEqual([{ id: 'e-1', qr_code_value: 'e-1' }]);
  });
});
