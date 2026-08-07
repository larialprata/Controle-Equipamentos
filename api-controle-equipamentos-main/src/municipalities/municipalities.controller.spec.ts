import { MunicipalitiesController } from './municipalities.controller';
import { MunicipalitiesService } from './municipalities.service';

describe('MunicipalitiesController', () => {
  let controller: MunicipalitiesController;
  let service: {
    findByObra: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findByObra: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    controller = new MunicipalitiesController(service as unknown as MunicipalitiesService);
  });

  it('getByObra deve listar municípios da obra', async () => {
    service.findByObra.mockResolvedValue([{ id: 'm-1' }]);

    const result = await controller.getByObra('o-1');

    expect(service.findByObra).toHaveBeenCalledWith('o-1');
    expect(result).toEqual([{ id: 'm-1' }]);
  });

  it('getOne deve buscar município por id', async () => {
    service.findOne.mockResolvedValue({ id: 'm-1' });

    const result = await controller.getOne('m-1');

    expect(service.findOne).toHaveBeenCalledWith('m-1');
    expect(result).toEqual({ id: 'm-1' });
  });

  it('create deve delegar criação ao service', async () => {
    const dto = { name: 'Cidade', obra_id: 'o-1' };
    service.create.mockResolvedValue({ id: 'm-1' });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'm-1' });
  });

  it('update deve delegar atualização ao service', async () => {
    const dto = { name: 'Novo', active: true };
    service.update.mockResolvedValue({ id: 'm-1' });

    const result = await controller.update('m-1', dto);

    expect(service.update).toHaveBeenCalledWith('m-1', dto);
    expect(result).toEqual({ id: 'm-1' });
  });
});
