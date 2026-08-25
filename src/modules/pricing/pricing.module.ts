import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule, PlatformSettingsModule],
  controllers: [PricingRulesController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
