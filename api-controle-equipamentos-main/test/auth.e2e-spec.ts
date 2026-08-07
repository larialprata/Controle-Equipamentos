import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { StorageService } from '../src/storage/storage.service';
import { UsersService } from '../src/users/users.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const authServiceMock = {
    validateUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  };
  const usersServiceMock = { updateUser: jest.fn() };
  const authGuardMock: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = { email: 'a@a.com', full_name: 'Nome', id: 'u-1' };
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        {
          provide: StorageService,
          useValue: { isConfigured: jest.fn().mockReturnValue(true), uploadCnh: jest.fn().mockResolvedValue('/url') },
        },
      ],
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

  it('POST /api/auth/login autentica usuário', async () => {
    authServiceMock.validateUser.mockResolvedValue({ id: 'u-1' });
    authServiceMock.login.mockResolvedValue({ access_token: 'token', user: { id: 'u-1' } });
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@a.com', password: '123456' })
      .expect(201)
      .expect({ message: 'Authenticated', access_token: 'token', user: { id: 'u-1' } });
  });

  it('GET /api/auth/me retorna usuário do token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer fake')
      .expect(200)
      .expect({ user: { email: 'a@a.com', full_name: 'Nome' } });
  });
});
