import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPartsController } from './admin-parts.controller';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';

@Module({
  imports: [AuthModule],
  controllers: [PartsController, AdminPartsController],
  providers: [PartsService],
  exports: [PartsService],
})
export class PartsModule {}
