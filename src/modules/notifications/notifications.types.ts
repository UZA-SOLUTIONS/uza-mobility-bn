import type { Notification, NotificationType, Prisma } from '@prisma/client';

export const NOTIFICATION_SOCKET_EVENT = 'notification';
export const userNotificationRoom = (userId: string) => `user:${userId}`;

export type NotificationMetadata = Prisma.InputJsonValue;

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: NotificationMetadata;
  /** Skip SMTP even when mail is enabled. */
  skipEmail?: boolean;
  /** Send email even when the user account is deactivated (e.g. deactivation notice). */
  emailDespiteInactive?: boolean;
  /** Skip WebSocket emit (e.g. batch jobs). */
  skipRealtime?: boolean;
  emailSubject?: string;
  emailHtml?: string;
  emailAttachments?: Array<{ filename: string; content: Buffer }>;
}

export type NotificationPayload = Pick<
  Notification,
  | 'id'
  | 'userId'
  | 'type'
  | 'title'
  | 'body'
  | 'isRead'
  | 'metadata'
  | 'createdAt'
>;

export function toNotificationPayload(
  notification: Notification,
): NotificationPayload {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    metadata: notification.metadata,
    createdAt: notification.createdAt,
  };
}
