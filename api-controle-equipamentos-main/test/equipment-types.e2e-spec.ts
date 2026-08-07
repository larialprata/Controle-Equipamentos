import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EquipmentTypesController } from '../src/equipment-types/equipment-types.controller';
import { EquipmentTypesService } from '../src/equipment-types/equipment-types.service';

describe('EquipmentTypesController (e2e)', () => {
  let app: INestApplication<App>;
  const serviceMock = { findAll: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EquipmentTypesController],
      providers: [{ provide: EquipmentTypesService, useValue: serviceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /api/equipment-types retorna lista de tipos', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: 't-1' }]);

    await request(app.getHttpServer())
      .get('/api/equipment-types')
      .expect(200)
      .expect([{ id: 't-1' }]);
  });

  it('GET /api/equipment-types/:id retorna um tipo', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 't-1' });

    await request(app.getHttpServer())
      .get('/api/equipment-types/t-1')
      .expect(200)
      .expect({ id: 't-1' });
  });
});
