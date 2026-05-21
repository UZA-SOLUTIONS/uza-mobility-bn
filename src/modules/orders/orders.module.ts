import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SustainabilityService } from './sustainability.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, SustainabilityService],
  exports: [OrdersService],
})
export class OrdersModule {}
