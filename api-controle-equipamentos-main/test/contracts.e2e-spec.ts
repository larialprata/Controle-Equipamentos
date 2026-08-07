import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ContractsController } from '../src/contracts/contracts.controller';
import { ContractsService } from '../src/contracts/contracts.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { OptionalAuthGuard } from '../src/auth/guards/optional-auth.guard';

describe('ContractsController (e2e)', () => {
  let app: INestApplication<App>;

  const contractsServiceMock = {
    findAllActive: jest.fn(),
    findMyContract: jest.fn(),
    findObrasByContract: jest.fn(),
  };

  const optionalAuthGuardMock: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const hasAuthHeader = Boolean(req.headers.authorization);
      req.user = hasAuthHeader ? { id: 'user-1' } : null;
      return true;
    },
  };

  const authGuardMock: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'user-1' };
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: contractsServiceMock }],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue(optionalAuthGuardMock)
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

  it('GET /api/contracts retorna contratos ativos', async () => {
    contractsServiceMock.findAllActive.mockResolvedValue([{ id: 'c-1' }]);

    await request(app.getHttpServer())
      .get('/api/contracts')
      .expect(200)
      .expect({ contracts: [{ id: 'c-1' }] });

    expect(contractsServiceMock.findAllActive).toHaveBeenCalledTimes(1);
  });

  it('GET /api/contracts?mine=true sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/contracts?mine=true').expect(401);
  });

  it('GET /api/contracts?mine=true com token retorna contrato do usuário', async () => {
    contractsServiceMock.findMyContract.mockResolvedValue({ id: 'c-10' });

    await request(app.getHttpServer())
      .get('/api/contracts?mine=true')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)
      .expect({ contracts: [{ id: 'c-10' }] });

    expect(contractsServiceMock.findMyContract).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/contracts/my-contract retorna contrato atual', async () => {
    contractsServiceMock.findMyContract.mockResolvedValue({ id: 'c-20' });

    await request(app.getHttpServer())
      .get('/api/contracts/my-contract')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)
      .expect({ contract: { id: 'c-20' } });
  });

  it('GET /api/contracts/:contractId/obras retorna obras do contrato', async () => {
    contractsServiceMock.findObrasByContract.mockResolvedValue([{ id: 'o-1' }]);

    await request(app.getHttpServer())
      .get('/api/contracts/c-1/obras')
      .expect(200)
      .expect({ obras: [{ id: 'o-1' }] });

    expect(contractsServiceMock.findObrasByContract).toHaveBeenCalledWith('c-1');
  });
});
