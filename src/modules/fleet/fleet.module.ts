import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { PdfModule } from '../../common/pdf/pdf.module';
import { UploadsModule } from '../../common/uploads/uploads.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AdminFleetController } from './admin-fleet.controller';
import { FleetController } from './fleet.controller';
import { FleetPdfStorageService } from './fleet-pdf-storage.service';
import { FleetRequestPdfService } from './fleet-request-pdf.service';
import { FleetService } from './fleet.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    PdfModule,
    UploadsModule,
    PlatformSettingsModule,
  ],
  controllers: [FleetController, AdminFleetController],
  providers: [FleetService, FleetRequestPdfService, FleetPdfStorageService],
  exports: [FleetService],
})
export class FleetModule {}
