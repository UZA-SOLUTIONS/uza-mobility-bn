import { Injectable, Logger } from '@nestjs/common';
import { ActivityLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AuditTransactionClient,
  RecordActivityInput,
} from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordActivityInput,
    tx?: AuditTransactionClient,
  ): Promise<ActivityLog> {
    const client = tx ?? this.prisma;

    try {
      const entry = await client.activityLog.create({
        data: this.buildCreateData(input),
      });

      this.logToTerminal(entry);
      return entry;
    } catch (error) {
      this.logger.error(
        `Failed to save activity log [${input.action}]`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private buildCreateData(
    input: RecordActivityInput,
  ): Prisma.ActivityLogCreateInput {
    const data: Prisma.ActivityLogCreateInput = {
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
    };

    if (input.userId) {
      data.user = { connect: { id: input.userId } };
    }

    if (input.metadata !== undefined && input.metadata !== null) {
      data.metadata = input.metadata;
    }

    return data;
  }

  private logToTerminal(entry: ActivityLog): void {
    const meta =
      entry.metadata && typeof entry.metadata === 'object'
        ? (entry.metadata as Record<string, unknown>)
        : null;

    const parts: string[] = [`action=${entry.action}`];

    if (entry.entity) {
      parts.push(`entity=${entry.entity}`);
    }

    const email =
      meta && typeof meta.email === 'string'
        ? meta.email
        : meta && typeof meta.performerEmail === 'string'
          ? meta.performerEmail
          : meta && typeof meta.targetEmail === 'string'
            ? meta.targetEmail
            : undefined;

    if (email) {
      parts.push(`email=${email}`);
    }

    if (entry.ipAddress) {
      parts.push(`ip=${entry.ipAddress}`);
    }

    if (entry.userAgent) {
      parts.push(`ua=${entry.userAgent.slice(0, 120)}`);
    }

    this.logger.log(`saved | ${parts.join(' | ')}`);
  }
}
