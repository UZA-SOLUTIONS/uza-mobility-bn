import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesCron } from './invoices.cron';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    InquiriesModule,
    PlatformSettingsModule,
    PricingModule,
  ],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoicesCron],
  exports: [InvoicesService],
})
export class InvoicesModule {}
