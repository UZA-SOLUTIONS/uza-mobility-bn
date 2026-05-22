import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { SellersModule } from '../sellers/sellers.module';
import { AdminListingsController } from './admin-listings.controller';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [AuthModule, SellersModule, PricingModule],
  controllers: [ListingsController, AdminListingsController],
  providers: [ListingsService, SearchService, VerificationService],
  exports: [ListingsService, SearchService],
})
export class ListingsModule {}
