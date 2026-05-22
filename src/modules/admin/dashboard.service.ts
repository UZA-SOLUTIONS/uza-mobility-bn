import { Injectable } from '@nestjs/common';
import {
  FleetRequestStatus,
  FinancingStatus,
  ListingStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SustainabilityService } from '../sustainability/sustainability.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sustainabilityService: SustainabilityService,
  ) {}

  async getOverview() {
    const [
      totalListings,
      pendingListings,
      totalOrders,
      pendingPayments,
      activeFleetRequests,
      pendingFinancing,
      impact,
    ] = await Promise.all([
      this.prisma.listing.count({
        where: { status: ListingStatus.PUBLISHED, deletedAt: null },
      }),
      this.prisma.listing.count({
        where: { status: ListingStatus.PENDING_REVIEW, deletedAt: null },
      }),
      this.prisma.order.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUBMITTED } }),
      this.prisma.fleetRequest.count({
        where: {
          status: {
            in: [
              FleetRequestStatus.SUBMITTED,
              FleetRequestStatus.UNDER_REVIEW,
              FleetRequestStatus.QUOTED,
            ],
          },
        },
      }),
      this.prisma.financingRequest.count({
        where: {
          status: {
            in: [FinancingStatus.SUBMITTED, FinancingStatus.UNDER_REVIEW],
          },
        },
      }),
      this.sustainabilityService.getPublicImpactCounters(),
    ]);

    return {
      listings: { total: totalListings, pendingReview: pendingListings },
      orders: { total: totalOrders },
      payments: { pendingVerification: pendingPayments },
      fleet: { active: activeFleetRequests },
      financing: { pending: pendingFinancing },
      impact,
    };
  }
}
