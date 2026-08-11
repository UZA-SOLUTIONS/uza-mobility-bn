import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminPlatformSettingsController, ExchangeRateController],
  providers: [PlatformSettingsService, ExchangeRateService],
  exports: [PlatformSettingsService, ExchangeRateService],
})
export class PlatformSettingsModule {}
