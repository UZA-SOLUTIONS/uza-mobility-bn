import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoicesCron {
  private readonly logger = new Logger(InvoicesCron.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireInvoices(): Promise<void> {
    const count = await this.invoicesService.expireDueInvoices();
    if (count > 0) {
      this.logger.log(`Expired ${count} invoice(s)`);
    }
  }
}
