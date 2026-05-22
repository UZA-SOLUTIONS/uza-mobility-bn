import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPromotionsController } from './admin-promotions.controller';
import { PromotionsController } from './promotions.controller';
import { PromotionsCron } from './promotions.cron';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [AuthModule],
  controllers: [PromotionsController, AdminPromotionsController],
  providers: [PromotionsService, PromotionsCron],
  exports: [PromotionsService],
})
export class PromotionsModule {}
