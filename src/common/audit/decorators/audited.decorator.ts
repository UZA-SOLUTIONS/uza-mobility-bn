import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

/** Override the default HTTP-derived audit action for this handler. */
export const Audited = (action: string) =>
  SetMetadata(AUDIT_ACTION_KEY, action);
