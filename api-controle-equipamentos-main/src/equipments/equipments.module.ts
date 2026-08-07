import { Module } from '@nestjs/common';
import { EquipmentsController } from './equipments.controller';
import { EquipmentsService } from './equipments.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
