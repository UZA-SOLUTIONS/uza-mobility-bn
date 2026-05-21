import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  NOTIFICATION_SOCKET_EVENT,
  type NotificationPayload,
  userNotificationRoom,
} from './notifications.types';
import { WsAuthService } from './ws-auth.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.wsAuth.authenticate(client);

    if (!user) {
      this.logger.debug(`WS rejected: ${client.id}`);
      client.disconnect(true);
      return;
    }

    client.data.userId = user.sub;
    await client.join(userNotificationRoom(user.sub));
    this.logger.debug(`WS connected: user=${user.sub} socket=${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.logger.debug(`WS disconnected: user=${userId} socket=${client.id}`);
    }
  }

  emitToUser(userId: string, payload: NotificationPayload): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(userNotificationRoom(userId))
      .emit(NOTIFICATION_SOCKET_EVENT, payload);
  }
}
