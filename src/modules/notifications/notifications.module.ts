import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailService } from './mail.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { WsAuthService } from './ws-auth.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    MailService,
    WsAuthService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
