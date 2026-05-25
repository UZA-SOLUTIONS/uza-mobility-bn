import type { SubmitPaymentDto } from './submit-payment.dto';

export type SubmitPaymentPayload = SubmitPaymentDto & {
  proofUrls?: string[];
};
