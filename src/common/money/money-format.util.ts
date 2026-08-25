/** Shared money labels for emails, PDFs, and notifications. */

export function formatUsdtLabel(amount: number): string {
  return `${amount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })} USDT`;
}

export function formatUsdLabel(amount: number): string {
  return `USD ${amount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}

export function formatRwfLabel(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })} Rwf`;
}

export function usdtToRwfAmount(
  amountUsdt: number,
  usdToRwfEffective: number,
): number {
  return Math.round(amountUsdt * usdToRwfEffective);
}

export function rwfToUsdAmount(
  amountRwf: number,
  usdToRwfEffective: number,
): number {
  if (!Number.isFinite(usdToRwfEffective) || usdToRwfEffective <= 0) {
    return 0;
  }
  return Math.round((amountRwf / usdToRwfEffective) * 100) / 100;
}

export function toDisplayRwf(params: {
  currency?: string | null;
  amountRwf?: number | null;
  amountUsd?: number | null;
  frozenRate?: number | null;
}): number | null {
  if (params.currency === 'RWF' && params.amountRwf != null) {
    return Math.round(params.amountRwf);
  }
  if (params.amountRwf != null && Number.isFinite(params.amountRwf)) {
    return Math.round(params.amountRwf);
  }
  if (
    params.amountUsd != null &&
    Number.isFinite(params.amountUsd) &&
    params.frozenRate != null &&
    params.frozenRate > 0
  ) {
    return usdtToRwfAmount(params.amountUsd, params.frozenRate);
  }
  return null;
}

export function formatMoneyRwf(
  amountRwf: number | null | undefined,
  options?: { empty?: string },
): string {
  const empty = options?.empty ?? 'On request';
  if (amountRwf == null || !Number.isFinite(amountRwf)) {
    return empty;
  }
  return formatRwfLabel(amountRwf);
}

/** RWF-primary label. USD amounts convert with the frozen rate when needed. */
export function formatDualMoney(
  amountUsdt: number | null | undefined,
  usdToRwfEffective: number | null | undefined,
  options?: {
    unit?: 'USDT' | 'USD';
    empty?: string;
  },
): string {
  const empty = options?.empty ?? 'On request';
  const rwf = toDisplayRwf({
    amountUsd: amountUsdt,
    frozenRate: usdToRwfEffective,
  });
  if (rwf == null) {
    return empty;
  }
  return formatRwfLabel(rwf);
}
