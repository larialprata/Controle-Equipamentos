import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { ContractsModule } from './contracts/contracts.module';
import { EquipmentsModule } from './equipments/equipments.module';
import { EquipmentTypesModule } from './equipment-types/equipment-types.module';
import { MunicipalitiesModule } from './municipalities/municipalities.module';
import { CheckOperationsModule } from './check-operations/check-operations.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    StorageModule,
    ContractsModule,
    EquipmentsModule,
    EquipmentTypesModule,
    MunicipalitiesModule,
    CheckOperationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
