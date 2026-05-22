import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SustainabilityModule } from '../sustainability/sustainability.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, SustainabilityModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
