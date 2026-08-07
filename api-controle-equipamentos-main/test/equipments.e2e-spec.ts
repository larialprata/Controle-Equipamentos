import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EquipmentsController } from '../src/equipments/equipments.controller';
import { EquipmentsService } from '../src/equipments/equipments.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { AdminGuard } from '../src/auth/guards/admin.guard';

describe('EquipmentsController (e2e)', () => {
  let app: INestApplication<App>;
  const serviceMock = {
    findAllActive: jest.fn(),
    findByContract: jest.fn(),
    findByQrCode: jest.fn(),
  };

  const authGuardMock: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      if (!req.headers.authorization) {
        throw new UnauthorizedException();
      }
      req.user = { id: 'u-1', is_admin: true, contract_id: 'c-1' };
      return true;
    },
  };
  const adminGuardMock: CanActivate = { canActivate: () => true };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EquipmentsController],
      providers: [{ provide: EquipmentsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardMock)
      .overrideGuard(AdminGuard)
      .useValue(adminGuardMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /api/equipments retorna ativos', async () => {
    serviceMock.findAllActive.mockResolvedValue([{ id: 'e-1' }]);

    await request(app.getHttpServer())
      .get('/api/equipments')
      .set('Authorization', 'Bearer fake')
      .expect(200)
      .expect({ equipments: [{ id: 'e-1' }] });
  });

  it('GET /api/equipments/qr/:qrCode sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/equipments/qr/qr-123').expect(401);
  });

  it('GET /api/equipments/qr/:qrCode com token retorna equipamento resolvido', async () => {
    serviceMock.findByQrCode.mockResolvedValue({ id: 'e-2' });

    await request(app.getHttpServer())
      .get('/api/equipments/qr/qr-123')
      .set('Authorization', 'Bearer fake')
      .expect(200)
      .expect({ equipment: { id: 'e-2' } });
  });

  it('GET /api/equipments/contract/:contractId retorna lista', async () => {
    serviceMock.findByContract.mockResolvedValue([{ id: 'e-3' }]);

    await request(app.getHttpServer())
      .get('/api/equipments/contract/c-1')
      .set('Authorization', 'Bearer fake')
      .expect(200)
      .expect({ equipments: [{ id: 'e-3' }] });
  });
});
