import type { CompanyPaymentDetails } from '../../modules/platform-settings/platform-settings.constants';

export function formatRwfBankAccountsHtml(params: {
  legalName: string;
  rwfBankName: string;
  rwfAccountNumber: string;
  escapeHtml?: (value: string) => string;
  asTableRows?: boolean;
  asLineBreaks?: boolean;
}): string {
  const esc = params.escapeHtml ?? ((value: string) => value);

  if (params.asTableRows) {
    return `
      <tr><td class="label">Beneficiary</td><td>${esc(params.legalName)}</td></tr>
      <tr><td class="label">Bank</td><td>${esc(params.rwfBankName)}</td></tr>
      <tr><td class="label">Account number</td><td>${esc(params.rwfAccountNumber)}</td></tr>
      <tr><td class="label">Note</td><td>Pay in Rwf. Include your payment reference on the transfer.</td></tr>`;
  }

  if (params.asLineBreaks) {
    return `Beneficiary: ${esc(params.legalName)}<br />
    Rwf account — ${esc(params.rwfBankName)} · ${esc(params.rwfAccountNumber)}<br />
    Pay in Rwf only`;
  }

  return `
        <ul style="margin: 4px 0 0; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Beneficiary: ${esc(params.legalName)}</li>
          <li>Rwf account — ${esc(params.rwfBankName)} · ${esc(params.rwfAccountNumber)}</li>
          <li>Pay in Rwf. Method: TT bank transfer</li>
        </ul>`;
}

/** Historical USD invoices still show both receiving accounts. */
export function formatDualBankAccountsHtml(params: {
  legalName: string;
  usdBankName: string;
  usdAccountNumber: string;
  rwfBankName: string;
  rwfAccountNumber: string;
  escapeHtml?: (value: string) => string;
  asTableRows?: boolean;
  asLineBreaks?: boolean;
}): string {
  const esc = params.escapeHtml ?? ((value: string) => value);

  if (params.asTableRows) {
    return `
      <tr><td class="label">Beneficiary</td><td>${esc(params.legalName)}</td></tr>
      <tr><td class="label">USD account — Bank</td><td>${esc(params.usdBankName)}</td></tr>
      <tr><td class="label">USD account — Number</td><td>${esc(params.usdAccountNumber)}</td></tr>
      <tr><td class="label">Rwf account — Bank</td><td>${esc(params.rwfBankName)}</td></tr>
      <tr><td class="label">Rwf account — Number</td><td>${esc(params.rwfAccountNumber)}</td></tr>
      <tr><td class="label">Note</td><td>Pay to either the USD or Rwf account. Include your payment reference on the transfer.</td></tr>`;
  }

  if (params.asLineBreaks) {
    return `Beneficiary: ${esc(params.legalName)}<br />
    USD account — ${esc(params.usdBankName)} · ${esc(params.usdAccountNumber)}<br />
    Rwf account — ${esc(params.rwfBankName)} · ${esc(params.rwfAccountNumber)}<br />
    Pay to either the USD or Rwf account`;
  }

  return `
        <ul style="margin: 4px 0 0; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Beneficiary: ${esc(params.legalName)}</li>
          <li>USD account — ${esc(params.usdBankName)} · ${esc(params.usdAccountNumber)}</li>
          <li>Rwf account — ${esc(params.rwfBankName)} · ${esc(params.rwfAccountNumber)}</li>
          <li>Pay to either account (USD or Rwf). Method: TT bank transfer</li>
        </ul>`;
}

export function formatInvoiceBankAccountsHtml(params: {
  currency?: string | null;
  legalName: string;
  usdBankName: string;
  usdAccountNumber: string;
  rwfBankName: string;
  rwfAccountNumber: string;
  escapeHtml?: (value: string) => string;
  asTableRows?: boolean;
  asLineBreaks?: boolean;
}): string {
  if (params.currency === 'USD') {
    return formatDualBankAccountsHtml(params);
  }
  return formatRwfBankAccountsHtml(params);
}

export function dualBankParamsFromCompany(
  company: CompanyPaymentDetails,
  overrides?: {
    usdBankName?: string | null;
    usdAccountNumber?: string | null;
    rwfBankName?: string | null;
    rwfAccountNumber?: string | null;
    legalName?: string | null;
  },
) {
  return {
    legalName: overrides?.legalName ?? company.legalName,
    usdBankName: overrides?.usdBankName ?? company.usd.bankName,
    usdAccountNumber: overrides?.usdAccountNumber ?? company.usd.accountNumber,
    rwfBankName: overrides?.rwfBankName ?? company.rwf.bankName,
    rwfAccountNumber: overrides?.rwfAccountNumber ?? company.rwf.accountNumber,
  };
}
