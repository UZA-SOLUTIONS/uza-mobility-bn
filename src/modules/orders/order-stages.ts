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
