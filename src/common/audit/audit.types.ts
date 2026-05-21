import type { Prisma } from '@prisma/client';

export interface RecordActivityInput {
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export type AuditTransactionClient = Prisma.TransactionClient;
