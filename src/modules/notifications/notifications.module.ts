import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../../common/mail/mail.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { WsAuthService } from './ws-auth.service';

@Global()
@Module({
  imports: [AuthModule, MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, WsAuthService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
