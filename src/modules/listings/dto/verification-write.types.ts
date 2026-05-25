import type { UpdateVerificationDto } from './update-verification.dto';

export type UpdateVerificationPayload = UpdateVerificationDto & {
  reportUrl?: string;
  batteryReportUrl?: string;
};
