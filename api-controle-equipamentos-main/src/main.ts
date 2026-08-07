import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response, NextFunction, json, urlencoded } from 'express';

async function bootstrap() {
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be set');
  }

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Increase body size limit to support larger JSON payloads and image uploads.
  app.use(
    json({
      limit: '50mb',
    }),
  );
  app.use(
    urlencoded({
      limit: '50mb',
      extended: true,
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS: domínio de produção sempre permitido; APP_ORIGIN adiciona extras (ex.: IP local).
  const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, '');
  const fromEnv = (process.env.APP_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const builtInOrigins = [
    'https://controle.dimensionalengenharia.com',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001']
      : []),
  ];
  const allowedOrigins = [...new Set([...builtInOrigins, ...fromEnv])];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server calls and tools without browser origin
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      const isPrivateLanOrigin =
        /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(normalizedOrigin) ||
        /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(normalizedOrigin);
      const isAllowed =
        allowedOrigins.includes(normalizedOrigin) ||
        (process.env.NODE_ENV !== 'production' && isPrivateLanOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${normalizedOrigin} não permitida pelo CORS`), false);
    },
    credentials: true,
  });

  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  const swaggerPath = 'api-docs';

  if (swaggerEnabled) {
    app.use(`/${swaggerPath}`, (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      next();
    });

    const config = new DocumentBuilder()
      .setTitle('Equipment Check-In/Out API')
      .setDescription('API para gerenciamento de check-in e check-out de equipamentos em contratos')
      .setVersion('1.0')
      .addTag('Contracts', 'Endpoints para gerenciar contratos')
      .addTag('Equipments', 'Endpoints para gerenciar equipamentos')
      .addTag('Check Operations', 'Endpoints para operações de check-in/check-out')
      .addTag('Health', 'Endpoint de verificação de saúde')
      .addTag('Auth', 'Endpoints de autenticação')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document, {
      customSiteTitle: 'Equipment Check API',
      customCss: `
      .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { font-size: 32px; color: #1a1a1a; font-weight: 600; }
      .swagger-ui .info .description { font-size: 15px; color: #4a4a4a; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .swagger-ui .opblock { border-radius: 8px; margin: 15px 0; border: 1px solid #e0e0e0; }
      .swagger-ui .opblock-tag { font-size: 20px; font-weight: 600; color: #2c3e50; padding: 15px 20px; }
      .swagger-ui .opblock .opblock-summary { padding: 12px 20px; }
      .swagger-ui .btn { border-radius: 6px; font-weight: 500; }
      .swagger-ui .response-col_status { font-weight: 600; }
      .swagger-ui table thead tr th { font-weight: 600; color: #2c3e50; border-bottom: 2px solid #e0e0e0; }
    `,
      customfavIcon:
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📋</text></svg>',
    });
  }

  const port = 3000;
  const host = '0.0.0.0';
  await app.listen(port, host);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🌐 Rede local: http://<seu-ip>:${port}`);
  if (swaggerEnabled) {
    logger.log(`📚 API Documentation available at: http://localhost:${port}/${swaggerPath}`);
  } else {
    logger.log('Swagger desativado em produção. Defina SWAGGER_ENABLED=true para expor /api-docs.');
  }
}

bootstrap();
