import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesCron } from './invoices.cron';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoicesCron],
  exports: [InvoicesService],
})
export class InvoicesModule {}
