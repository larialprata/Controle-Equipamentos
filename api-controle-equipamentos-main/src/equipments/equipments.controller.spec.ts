import { EquipmentsController } from './equipments.controller';
import { EquipmentsService } from './equipments.service';

describe('EquipmentsController', () => {
  let controller: EquipmentsController;
  let service: {
    findAllActive: jest.Mock;
    findByContract: jest.Mock;
    findByQrCode: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findAllActive: jest.fn(),
      findByContract: jest.fn(),
      findByQrCode: jest.fn(),
    };
    controller = new EquipmentsController(service as unknown as EquipmentsService);
  });

  it('getEquipments deve listar todos ativos', async () => {
    service.findAllActive.mockResolvedValue([{ id: 'e-1' }]);

    const result = await controller.getEquipments();

    expect(service.findAllActive).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ equipments: [{ id: 'e-1' }] });
  });

  it('getEquipmentsByContract deve listar por contrato', async () => {
    service.findByContract.mockResolvedValue([{ id: 'e-3' }]);

    const result = await controller.getEquipmentsByContract('c-1');

    expect(service.findByContract).toHaveBeenCalledWith('c-1');
    expect(result).toEqual({ equipments: [{ id: 'e-3' }] });
  });

  it('getEquipmentByQrCode deve delegar para o service com usuário autenticado', async () => {
    service.findByQrCode.mockResolvedValue({ id: 'e-9' });

    const result = await controller.getEquipmentByQrCode({ user: { id: 'u-1' } } as never, 'qr-123');

    expect(service.findByQrCode).toHaveBeenCalledWith('qr-123', 'u-1');
    expect(result).toEqual({ equipment: { id: 'e-9' } });
  });
});
