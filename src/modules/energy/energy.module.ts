import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminEnergyController } from './admin-energy.controller';
import { EnergyController } from './energy.controller';
import { EnergyService } from './energy.service';

@Module({
  imports: [AuthModule],
  controllers: [EnergyController, AdminEnergyController],
  providers: [EnergyService],
  exports: [EnergyService],
})
export class EnergyModule {}
