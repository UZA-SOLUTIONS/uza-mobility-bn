import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { UploadsModule } from '../../common/uploads/uploads.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    InquiriesModule,
    PlatformSettingsModule,
    UploadsModule,
  ],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
