import { Module } from '@nestjs/common';
import { UploadsModule } from '../../common/uploads/uploads.module';
import { PricingModule } from '../pricing/pricing.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SellersModule } from '../sellers/sellers.module';
import { UsersModule } from '../../users/users.module';
import { AdminListingsController } from './admin-listings.controller';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { VerificationService } from './verification.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    UploadsModule,
    UsersModule,
    SellersModule,
    PricingModule,
    PromotionsModule,
  ],
  controllers: [ListingsController, AdminListingsController],
  providers: [ListingsService, SearchService, VerificationService],
  exports: [ListingsService, SearchService],
})
export class ListingsModule {}
