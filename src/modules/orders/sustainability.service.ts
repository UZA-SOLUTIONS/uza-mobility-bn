import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Records delivery sustainability metrics (doc-05 expands this). */
@Injectable()
export class SustainabilityService {
  private readonly logger = new Logger(SustainabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordDelivery(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { evSpecs: true } },
        user: { include: { buyerProfile: true } },
      },
    });

    if (!order?.listing) {
      return;
    }

    const rangeKm = order.listing.evSpecs?.rangeKm ?? 300;
    const estimatedFuelSavedL = rangeKm * 0.08;
    const estimatedCo2AvoidedKg = estimatedFuelSavedL * 2.31;

    await this.prisma.sustainabilityMetric.create({
      data: {
        listingId: order.listingId,
        orderId: order.id,
        vehicleType: `${order.listing.brand} ${order.listing.model}`.trim(),
        buyerType: order.user.buyerProfile?.buyerType,
        country: order.deliveryCountry ?? order.listing.country,
        estimatedFuelSavedL,
        estimatedCo2AvoidedKg,
        greenKmSupported: rangeKm,
      },
    });

    this.logger.log(
      `Sustainability metric recorded for order ${order.orderNumber}`,
    );
  }
}
