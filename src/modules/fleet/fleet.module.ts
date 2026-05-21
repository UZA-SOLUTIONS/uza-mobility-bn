import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminFleetController } from './admin-fleet.controller';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  imports: [AuthModule],
  controllers: [FleetController, AdminFleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
