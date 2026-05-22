import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSellersController } from './admin-sellers.controller';
import { SellersService } from './sellers.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminSellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
