import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckOperationsController } from './check-operations.controller';
import { CheckOperationsService } from './check-operations.service';

const authUser = (overrides: Partial<{ id: string; is_admin: boolean; contract_id: string | null }> = {}) => ({
  id: 'u-1',
  is_admin: false,
  contract_id: 'c-1',
  ...overrides,
});

describe('CheckOperationsController', () => {
  let controller: CheckOperationsController;
  let service: {
    findAll: jest.Mock;
    findByContract: jest.Mock;
    findLastCheckinByUser: jest.Mock;
    findOne: jest.Mock;
    findByPhotoFilename: jest.Mock;
    createOperation: jest.Mock;
    syncOperations: jest.Mock;
    deleteMany: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findByContract: jest.fn(),
      findLastCheckinByUser: jest.fn(),
      findOne: jest.fn(),
      findByPhotoFilename: jest.fn(),
      createOperation: jest.fn(),
      syncOperations: jest.fn(),
      deleteMany: jest.fn(),
    };
    controller = new CheckOperationsController(service as unknown as CheckOperationsService);
  });

  it('getAllOperations deve retornar lista', async () => {
    service.findAll.mockResolvedValue([{ id: 'o-1' }]);
    const result = await controller.getAllOperations();
    expect(result).toEqual([{ id: 'o-1' }]);
  });

  it('getOperationsByContract deve enviar filtros quando existem', async () => {
    service.findByContract.mockResolvedValue([]);
    await controller.getOperationsByContract(
      { user: authUser() } as never,
      'c-1',
      't-1',
      'ABC',
    );
    expect(service.findByContract).toHaveBeenCalledWith('c-1', { equipmentTypeId: 't-1', ativoPlaca: 'ABC' });
  });

  it('createOperation sem foto deve falhar', async () => {
    await expect(
      controller.createOperation({ user: { id: 'u-1' } } as never, {} as never, undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getOperationById deve falhar quando não existe', async () => {
    service.findOne.mockResolvedValue(null);
    await expect(controller.getOperationById({ user: authUser() } as never, 'o-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deleteOperationById deve falhar quando não deleta nada', async () => {
    service.deleteMany.mockResolvedValue({ deleted: 0 });
    await expect(controller.deleteOperationById('o-404')).rejects.toBeInstanceOf(NotFoundException);
  });
});
