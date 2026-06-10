import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { PdfModule } from '../../common/pdf/pdf.module';
import { UploadsModule } from '../../common/uploads/uploads.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AdminInquiriesController } from './admin-inquiries.controller';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { QuotePdfService } from './quote-pdf.service';
import { QuoteStorageService } from './quote-storage.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    PdfModule,
    UploadsModule,
    NotificationsModule,
    PlatformSettingsModule,
  ],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService, QuotePdfService, QuoteStorageService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
