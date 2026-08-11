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

/**
 * Primary settlement currency plus approximate Rwf (effective rate with markup).
 * Example: `12,000 USDT (≈ 17,673,935 Rwf)` or `USD 12,000 (≈ 17,673,935 Rwf)`.
 */
export function formatDualMoney(
  amountUsdt: number | null | undefined,
  usdToRwfEffective: number | null | undefined,
  options?: {
    unit?: 'USDT' | 'USD';
    empty?: string;
  },
): string {
  const empty = options?.empty ?? 'On request';
  if (amountUsdt == null || !Number.isFinite(amountUsdt)) {
    return empty;
  }

  const unit = options?.unit ?? 'USDT';
  const primary =
    unit === 'USD' ? formatUsdLabel(amountUsdt) : formatUsdtLabel(amountUsdt);

  if (
    usdToRwfEffective == null ||
    !Number.isFinite(usdToRwfEffective) ||
    usdToRwfEffective <= 0
  ) {
    return primary;
  }

  return `${primary} (≈ ${formatRwfLabel(
    usdtToRwfAmount(amountUsdt, usdToRwfEffective),
  )})`;
}
