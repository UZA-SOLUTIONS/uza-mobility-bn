import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminPlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
