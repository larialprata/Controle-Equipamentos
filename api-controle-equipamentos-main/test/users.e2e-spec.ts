import { CanActivate, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { AdminGuard } from '../src/auth/guards/admin.guard';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  const serviceMock = {
    findAll: jest.fn(),
    updateUser: jest.fn(),
    toggleUserStatus: jest.fn(),
    findOne: jest.fn(),
  };
  const allowGuard: CanActivate = { canActivate: () => true };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue(allowGuard)
      .overrideGuard(AdminGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /api/users retorna lista', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: 'u-1' }]);
    await request(app.getHttpServer())
      .get('/api/users')
      .expect(200)
      .expect({ message: 'Lista de usuários', users: [{ id: 'u-1' }] });
  });

  it('PATCH /api/users/:id atualiza usuário', async () => {
    serviceMock.updateUser.mockResolvedValue({ message: 'ok', user: { id: 'u-1' } });
    await request(app.getHttpServer())
      .patch('/api/users/u-1')
      .send({ is_admin: true })
      .expect(200)
      .expect({ message: 'ok', user: { id: 'u-1' } });
  });

  it('GET /api/users/:id retorna usuário', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'u-1' });
    await request(app.getHttpServer())
      .get('/api/users/u-1')
      .expect(200)
      .expect({ message: 'Usuário encontrado', user: { id: 'u-1' } });
  });
});
