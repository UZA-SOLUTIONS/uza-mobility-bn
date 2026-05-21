import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule],
  controllers: [PricingRulesController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
