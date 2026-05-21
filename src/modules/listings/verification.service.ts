import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { adminListingInclude } from './listings.constants';
import { toAdminListing } from './listing.mapper';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async updateVerification(
    listingId: string,
    dto: UpdateVerificationDto,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: { verificationLevel: dto.verificationLevel },
        include: adminListingInclude,
      });

      await tx.verificationReport.upsert({
        where: { listingId },
        create: {
          listingId,
          verificationLevel: dto.verificationLevel,
          inspectionStatus: dto.inspectionStatus,
          batteryReportStatus: dto.batteryReportStatus,
          documentStatus: dto.documentStatus,
          reportUrl: dto.reportUrl,
          batteryReportUrl: dto.batteryReportUrl,
          verifiedAt: new Date(),
        },
        update: {
          verificationLevel: dto.verificationLevel,
          inspectionStatus: dto.inspectionStatus,
          batteryReportStatus: dto.batteryReportStatus,
          documentStatus: dto.documentStatus,
          reportUrl: dto.reportUrl,
          batteryReportUrl: dto.batteryReportUrl,
          verifiedAt: new Date(),
        },
      });

      return updated;
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:verification-updated',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: listing.slug,
        verificationLevel: dto.verificationLevel,
      },
    });

    return toAdminListing(listing);
  }
}
