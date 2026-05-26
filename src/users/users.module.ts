import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { AdminBuyersController } from './admin-buyers.controller';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController, AdminUsersController, AdminBuyersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
