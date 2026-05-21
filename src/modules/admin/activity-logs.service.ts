import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterActivityLogsDto } from './dto/filter-activity-logs.dto';

const activityLogPublicSelect = {
  id: true,
  action: true,
  entity: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  occurredAt: true,
} satisfies Prisma.ActivityLogSelect;

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterActivityLogsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        select: activityLogPublicSelect,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private buildWhere(
    filters: FilterActivityLogsDto,
  ): Prisma.ActivityLogWhereInput {
    const where: Prisma.ActivityLogWhereInput = {};

    if (filters.email?.trim()) {
      const email = filters.email.trim();
      where.OR = [
        {
          metadata: {
            path: ['email'],
            string_contains: email,
            mode: 'insensitive',
          },
        },
        {
          metadata: {
            path: ['performerEmail'],
            string_contains: email,
            mode: 'insensitive',
          },
        },
        {
          metadata: {
            path: ['targetEmail'],
            string_contains: email,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filters.action?.trim()) {
      where.action = {
        contains: filters.action.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.entity?.trim()) {
      where.entity = {
        equals: filters.entity.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    return where;
  }
}
