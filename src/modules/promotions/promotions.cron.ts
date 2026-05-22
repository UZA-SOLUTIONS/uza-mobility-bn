import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PromotionsService } from './promotions.service';

@Injectable()
export class PromotionsCron {
  private readonly logger = new Logger(PromotionsCron.name);

  constructor(private readonly promotionsService: PromotionsService) {}

  @Cron('0 1 * * *')
  async deactivateExpired(): Promise<void> {
    const count = await this.promotionsService.deactivateExpired();
    if (count > 0) {
      this.logger.log(`Deactivated ${count} expired promotion(s)`);
    }
  }
}
