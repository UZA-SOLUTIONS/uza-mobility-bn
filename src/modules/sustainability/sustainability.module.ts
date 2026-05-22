import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSustainabilityController } from './admin-sustainability.controller';
import { SustainabilityController } from './sustainability.controller';
import { SustainabilityService } from './sustainability.service';

@Module({
  imports: [AuthModule],
  controllers: [SustainabilityController, AdminSustainabilityController],
  providers: [SustainabilityService],
  exports: [SustainabilityService],
})
export class SustainabilityModule {}
