import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { SellersModule } from '../sellers/sellers.module';
import { AdminPartsController } from './admin-parts.controller';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';

@Module({
  imports: [AuthModule, SellersModule, PricingModule, NotificationsModule],
  controllers: [PartsController, AdminPartsController],
  providers: [PartsService],
  exports: [PartsService],
})
export class PartsModule {}
