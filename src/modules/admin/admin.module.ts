import { Module } from '@nestjs/common';
import { PdfModule } from '../../common/pdf/pdf.module';
import { AuthModule } from '../auth/auth.module';
import { SustainabilityModule } from '../sustainability/sustainability.module';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DiscountSalesController } from './discount-sales.controller';
import { DiscountSalesPdfService } from './discount-sales-pdf.service';
import { DiscountSalesService } from './discount-sales.service';

@Module({
  imports: [AuthModule, SustainabilityModule, PdfModule],
  controllers: [
    ActivityLogsController,
    DashboardController,
    DiscountSalesController,
  ],
  providers: [
    ActivityLogsService,
    DashboardService,
    DiscountSalesService,
    DiscountSalesPdfService,
  ],
})
export class AdminModule {}
