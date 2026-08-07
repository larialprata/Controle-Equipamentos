import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CheckOperationsController } from '../src/check-operations/check-operations.controller';
import { CheckOperationsService } from '../src/check-operations/check-operations.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { AdminGuard } from '../src/auth/guards/admin.guard';

describe('CheckOperationsController (e2e)', () => {
  let app: INestApplication<App>;
  const serviceMock = {
    findAll: jest.fn(),
    findByContract: jest.fn(),
    findLastCheckinByUser: jest.fn(),
    findOne: jest.fn(),
    createOperation: jest.fn(),
    syncOperations: jest.fn(),
    deleteMany: jest.fn(),
  };
  const authGuardMock: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = {
        id: 'u-1',
        is_admin: true,
        contract_id: 'c-1',
      };
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CheckOperationsController],
      providers: [{ provide: CheckOperationsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardMock)
      .overrideGuard(AdminGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /api/check-operations retorna lista', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: 'o-1' }]);
    await request(app.getHttpServer())
      .get('/api/check-operations')
      .expect(200)
      .expect([{ id: 'o-1' }]);
  });

  it('GET /api/check-operations/contract/:id retorna lista', async () => {
    serviceMock.findByContract.mockResolvedValue([{ id: 'o-2' }]);
    await request(app.getHttpServer())
      .get('/api/check-operations/contract/c-1')
      .expect(200)
      .expect([{ id: 'o-2' }]);
  });

  it('GET /api/check-operations/:id retorna operação', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'o-1' });
    await request(app.getHttpServer())
      .get('/api/check-operations/o-1')
      .expect(200)
      .expect({ id: 'o-1' });
  });

  it('DELETE /api/check-operations/:id remove operação', async () => {
    serviceMock.deleteMany.mockResolvedValue({ deleted: 1 });
    await request(app.getHttpServer())
      .delete('/api/check-operations/o-1')
      .expect(200)
      .expect({ message: 'Operação excluída.', deleted: 1 });
  });
});
