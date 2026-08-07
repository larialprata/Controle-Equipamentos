import { CanActivate, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { MunicipalitiesController } from '../src/municipalities/municipalities.controller';
import { MunicipalitiesService } from '../src/municipalities/municipalities.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';

describe('MunicipalitiesController (e2e)', () => {
  let app: INestApplication<App>;
  const serviceMock = {
    findByObra: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const authGuardMock: CanActivate = { canActivate: () => true };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MunicipalitiesController],
      providers: [{ provide: MunicipalitiesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /api/municipalities?obraId=... retorna lista', async () => {
    serviceMock.findByObra.mockResolvedValue([{ id: 'm-1' }]);

    await request(app.getHttpServer())
      .get('/api/municipalities?obraId=o-1')
      .expect(200)
      .expect([{ id: 'm-1' }]);
  });

  it('GET /api/municipalities/:id retorna um município', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'm-1' });

    await request(app.getHttpServer())
      .get('/api/municipalities/m-1')
      .expect(200)
      .expect({ id: 'm-1' });
  });

  it('POST /api/municipalities cria município', async () => {
    serviceMock.create.mockResolvedValue({ id: 'm-2' });

    await request(app.getHttpServer())
      .post('/api/municipalities')
      .send({ name: 'Cidade', obra_id: 'o-1' })
      .expect(201)
      .expect({ id: 'm-2' });
  });

  it('PATCH /api/municipalities/:id atualiza município', async () => {
    serviceMock.update.mockResolvedValue({ id: 'm-1', active: false });

    await request(app.getHttpServer())
      .patch('/api/municipalities/m-1')
      .send({ active: false })
      .expect(200)
      .expect({ id: 'm-1', active: false });
  });
});
