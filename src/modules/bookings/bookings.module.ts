import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { UploadsModule } from '../../common/uploads/uploads.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, PlatformSettingsModule, UploadsModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
