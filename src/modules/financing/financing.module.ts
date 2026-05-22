import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBanksController } from './admin-banks.controller';
import { AdminFinancingController } from './admin-financing.controller';
import { FinancingController } from './financing.controller';
import { FinancingService } from './financing.service';

@Module({
  imports: [AuthModule],
  controllers: [
    FinancingController,
    AdminFinancingController,
    AdminBanksController,
  ],
  providers: [FinancingService],
  exports: [FinancingService],
})
export class FinancingModule {}
