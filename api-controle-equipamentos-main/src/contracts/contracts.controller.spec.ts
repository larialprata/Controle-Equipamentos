import { UnauthorizedException } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

describe('ContractsController', () => {
  let controller: ContractsController;
  let contractsService: {
    findAllActive: jest.Mock;
    create: jest.Mock;
    findMyContract: jest.Mock;
    findObrasByContract: jest.Mock;
  };

  beforeEach(() => {
    contractsService = {
      findAllActive: jest.fn(),
      create: jest.fn(),
      findMyContract: jest.fn(),
      findObrasByContract: jest.fn(),
    };

    controller = new ContractsController(contractsService as unknown as ContractsService);
  });

  it('getContracts deve listar todos quando mine não for true', async () => {
    contractsService.findAllActive.mockResolvedValue([{ id: 'c-1' }]);

    const result = await controller.getContracts(undefined, {} as never);

    expect(contractsService.findAllActive).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ contracts: [{ id: 'c-1' }] });
  });

  it('getContracts deve rejeitar mine=true sem usuário autenticado', async () => {
    await expect(controller.getContracts('true', { user: null } as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('getContracts deve retornar contrato do usuário com mine=true', async () => {
    contractsService.findMyContract.mockResolvedValue({ id: 'c-10' });

    const result = await controller.getContracts('true', { user: { id: 'user-1' } } as never);

    expect(contractsService.findMyContract).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ contracts: [{ id: 'c-10' }] });
  });

  it('getMyContract deve retornar contrato do usuário logado', async () => {
    contractsService.findMyContract.mockResolvedValue({ id: 'c-1' });

    const result = await controller.getMyContract({ user: { id: 'user-1' } } as never);

    expect(contractsService.findMyContract).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ contract: { id: 'c-1' } });
  });

  it('createContract deve retornar contrato cadastrado', async () => {
    contractsService.create.mockResolvedValue({ id: 'c-2', name: 'Contrato novo' });

    const result = await controller.createContract({ name: 'Contrato novo' });

    expect(contractsService.create).toHaveBeenCalledWith({ name: 'Contrato novo' });
    expect(result).toEqual({
      message: 'Contrato cadastrado com sucesso.',
      contract: { id: 'c-2', name: 'Contrato novo' },
    });
  });

  it('getObrasByContract deve retornar obras do contrato', async () => {
    contractsService.findObrasByContract.mockResolvedValue([{ id: 'o-1' }]);

    const result = await controller.getObrasByContract('c-1');

    expect(contractsService.findObrasByContract).toHaveBeenCalledWith('c-1');
    expect(result).toEqual({ obras: [{ id: 'o-1' }] });
  });
});
