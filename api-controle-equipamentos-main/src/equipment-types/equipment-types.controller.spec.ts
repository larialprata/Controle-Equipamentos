import { EquipmentTypesController } from './equipment-types.controller';
import { EquipmentTypesService } from './equipment-types.service';

describe('EquipmentTypesController', () => {
  let controller: EquipmentTypesController;
  let service: { findAll: jest.Mock; findOne: jest.Mock };

  beforeEach(() => {
    service = { findAll: jest.fn(), findOne: jest.fn() };
    controller = new EquipmentTypesController(service as unknown as EquipmentTypesService);
  });

  it('getTypes deve chamar findAll sem filtros', async () => {
    service.findAll.mockResolvedValue([{ id: 't-1' }]);

    const result = await controller.getTypes(undefined, undefined);

    expect(service.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([{ id: 't-1' }]);
  });

  it('getTypes deve chamar findAll com filtros', async () => {
    service.findAll.mockResolvedValue([{ id: 't-1' }]);

    await controller.getTypes('c-1', 'o-1');

    expect(service.findAll).toHaveBeenCalledWith({ contractId: 'c-1', obraId: 'o-1' });
  });

  it('getOne deve retornar um tipo', async () => {
    service.findOne.mockResolvedValue({ id: 't-1' });

    const result = await controller.getOne('t-1');

    expect(service.findOne).toHaveBeenCalledWith('t-1');
    expect(result).toEqual({ id: 't-1' });
  });
});
