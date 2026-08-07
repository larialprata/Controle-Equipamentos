import { CheckOperationsService } from './check-operations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('CheckOperationsService', () => {
  let service: CheckOperationsService;
  let prisma: {
    check_operations: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      check_operations: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new CheckOperationsService(
      prisma as unknown as PrismaService,
      { isConfigured: jest.fn().mockReturnValue(false) } as unknown as StorageService,
    );
  });

  it('findAll deve listar operações com nome do usuário', async () => {
    prisma.check_operations.findMany.mockResolvedValue([{ id: 'o-1', created_by_user: { full_name: 'Ana' } }]);
    const result = await service.findAll();
    expect(result[0]).toMatchObject({ id: 'o-1', created_by_user_name: 'Ana' });
  });

  it('findOne deve retornar null quando não encontra', async () => {
    prisma.check_operations.findUnique.mockResolvedValue(null);
    const result = await service.findOne('o-404');
    expect(result).toBeNull();
  });

  it('findByPhotoFilename deve retornar null para nome inválido', async () => {
    const result = await service.findByPhotoFilename('../x');
    expect(result).toBeNull();
    expect(prisma.check_operations.findFirst).not.toHaveBeenCalled();
  });

  it('findByContract deve aplicar filtro de contrato', async () => {
    prisma.check_operations.findMany.mockResolvedValue([]);
    await service.findByContract('c-1');
    expect(prisma.check_operations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contract_id: 'c-1' } }),
    );
  });

  it('deleteMany sem ids deve retornar zero', async () => {
    const result = await service.deleteMany([]);
    expect(result).toEqual({ deleted: 0 });
  });
});
