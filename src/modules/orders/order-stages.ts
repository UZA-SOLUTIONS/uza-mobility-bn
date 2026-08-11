import { OrderStatus, SellerType } from '@prisma/client';

export const ORDER_STAGES: Record<SellerType, OrderStatus[]> = {
  UZA_RWANDA_STOCK: [
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.VEHICLE_RESERVED,
    OrderStatus.READY_FOR_HANDOVER,
    OrderStatus.DELIVERED,
  ],
  LOCAL_SELLER: [
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.VEHICLE_RESERVED,
    OrderStatus.PROCESSING,
    OrderStatus.READY_FOR_HANDOVER,
    OrderStatus.DELIVERED,
  ],
  UZA_CHINA_SOURCING: [
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.VEHICLE_RESERVED,
    OrderStatus.PROCESSING,
    OrderStatus.IN_TRANSIT,
    OrderStatus.ARRIVED,
    OrderStatus.CLEARANCE,
    OrderStatus.READY_FOR_HANDOVER,
    OrderStatus.DELIVERED,
  ],
  INTERNATIONAL_SELLER: [
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.VEHICLE_RESERVED,
    OrderStatus.PROCESSING,
    OrderStatus.IN_TRANSIT,
    OrderStatus.ARRIVED,
    OrderStatus.CLEARANCE,
    OrderStatus.READY_FOR_HANDOVER,
    OrderStatus.DELIVERED,
  ],
};

export const STAGE_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.INVOICE_ISSUED]: 'Invoice Issued',
  [OrderStatus.PAYMENT_SUBMITTED]: 'Payment Submitted',
  [OrderStatus.PAYMENT_CONFIRMED]: 'Payment Confirmed',
  [OrderStatus.VEHICLE_RESERVED]: 'Vehicle Reserved',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.IN_TRANSIT]: 'In Transit',
  [OrderStatus.ARRIVED]: 'Arrived',
  [OrderStatus.CLEARANCE]: 'Customs Clearance',
  [OrderStatus.READY_FOR_HANDOVER]: 'Ready for Handover',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

/** Plain-language meaning for buyers when an order reaches this stage. */
export const STAGE_BUYER_MESSAGES: Record<OrderStatus, string> = {
  [OrderStatus.INVOICE_ISSUED]:
    'Your invoice has been issued. Please complete payment when ready.',
  [OrderStatus.PAYMENT_SUBMITTED]:
    'We received your payment submission and are verifying it.',
  [OrderStatus.PAYMENT_CONFIRMED]:
    'Your payment has been verified. Your order is now being processed.',
  [OrderStatus.VEHICLE_RESERVED]:
    'Your vehicle has been reserved for you and is secured for this order.',
  [OrderStatus.PROCESSING]:
    'Our team is preparing your vehicle for the next fulfillment steps.',
  [OrderStatus.IN_TRANSIT]:
    'Your vehicle is in transit. We will update you when it reaches port.',
  [OrderStatus.ARRIVED]:
    'Your vehicle has arrived at port. Clearance and handover steps will follow.',
  [OrderStatus.CLEARANCE]: 'Your vehicle is going through customs clearance.',
  [OrderStatus.READY_FOR_HANDOVER]:
    'Your vehicle is ready for handover. Our team will coordinate pickup or delivery with you.',
  [OrderStatus.DELIVERED]:
    'Your vehicle has been delivered. Thank you for choosing UZA Mobility.',
  [OrderStatus.CANCELLED]: 'This order has been cancelled.',
};

export function getNextOrderStatus(
  sellerType: SellerType,
  current: OrderStatus,
): OrderStatus | null {
  const stages = ORDER_STAGES[sellerType];
  const index = stages.indexOf(current);
  if (index < 0 || index >= stages.length - 1) {
    return null;
  }
  return stages[index + 1];
}
