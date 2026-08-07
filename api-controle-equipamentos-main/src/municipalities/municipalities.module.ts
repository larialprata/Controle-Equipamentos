import { Module } from '@nestjs/common';
import { MunicipalitiesController } from './municipalities.controller';
import { MunicipalitiesService } from './municipalities.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MunicipalitiesController],
  providers: [MunicipalitiesService],
  exports: [MunicipalitiesService],
})
export class MunicipalitiesModule {}
