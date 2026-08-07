import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './guards/auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    PassportModule,
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '7d';
        const secret = configService.get<string>('JWT_SECRET')?.trim();
        if (!secret) {
          throw new Error('JWT_SECRET must be set');
        }
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, AuthGuard, OptionalAuthGuard, AdminGuard, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthGuard, OptionalAuthGuard, AdminGuard, AuthService],
})
export class AuthModule {}

