import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminStationsController } from './admin-stations.controller';
import { OperatorsController } from './operators.controller';
import { StationsController } from './stations.controller';
import { ChargingStationsService } from './charging-stations.service';

@Module({
  imports: [AuthModule],
  controllers: [
    OperatorsController,
    StationsController,
    AdminStationsController,
  ],
  providers: [ChargingStationsService],
  exports: [ChargingStationsService],
})
export class ChargingStationsModule {}
