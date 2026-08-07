import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { EquipmentsModule } from '../equipments/equipments.module';
import { CheckOperationsController } from './check-operations.controller';
import { PublicMovimentacoesController } from './public-movimentacoes.controller';
import { CheckOperationsService } from './check-operations.service';

@Module({
  imports: [AuthModule, StorageModule, EquipmentsModule],
  controllers: [CheckOperationsController, PublicMovimentacoesController],
  providers: [CheckOperationsService],
})
export class CheckOperationsModule {}
