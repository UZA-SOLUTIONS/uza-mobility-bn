import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SustainabilityModule } from '../sustainability/sustainability.module';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, SustainabilityModule],
  controllers: [ActivityLogsController, DashboardController],
  providers: [ActivityLogsService, DashboardService],
})
export class AdminModule {}
