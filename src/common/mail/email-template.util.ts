/** Email palette — light frame, flat card, minimal chrome. */
export const EMAIL_BRAND = {
  pageBg: '#f4f7f9',
  cardBg: '#ffffff',
  text: '#1f2328',
  textMuted: '#656d76',
  textBody: '#424a53',
  link: '#174438',
  border: '#e5e7eb',
  white: '#ffffff',
} as const;

export type BrandedEmailParams = {
  appName: string;
  tagline?: string;
  logoUrl: string;
  recipientName?: string;
  headline: string;
  bodyHtml: string;
  actionUrl?: string;
  actionLabel?: string;
  /** Optional helper note kept inside the card (tips, next steps). */
  infoBoxHtml?: string;
  /** Why the recipient is receiving this email — shown below the card. */
  footerReason?: string;
  companyLegalName?: string;
  companyLocation?: string;
  websiteUrl?: string;
  supportUrl?: string;
  year?: number;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BODY_TEXT_STYLE = `
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 22px;
  color: ${EMAIL_BRAND.textBody};
`.trim();

const FOOTER_TEXT_STYLE = `
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 18px;
  color: ${EMAIL_BRAND.textMuted};
  text-align: center;
`.trim();

export function buildBrandedEmailHtml(params: BrandedEmailParams): string {
  const year = params.year ?? new Date().getFullYear();
  const greeting = params.recipientName
    ? `Hello ${escapeHtml(params.recipientName)},`
    : 'Hello,';
  const companyLegalName = params.companyLegalName ?? params.appName;
  const companyLocation = params.companyLocation ?? 'Kigali, Rwanda';

  const ctaBlock =
    params.actionUrl && params.actionLabel
      ? `
                <p style="margin: 16px 0 0; font-size: 14px; line-height: 22px">
                  <a
                    href="${params.actionUrl}"
                    target="_blank"
                    style="
                      color: ${EMAIL_BRAND.link};
                      text-decoration: underline;
                    "
                  >
                    ${escapeHtml(params.actionLabel)}
                  </a>
                </p>`
      : '';

  const infoBoxBlock = params.infoBoxHtml
    ? `
                <p style="margin: 16px 0 0; ${BODY_TEXT_STYLE.replace('margin: 0 0 12px;', 'margin: 0;')}">
                  ${params.infoBoxHtml}
                </p>`
    : '';

  const websiteUrl = params.websiteUrl ?? '#';
  const supportUrl = params.supportUrl ?? websiteUrl;

  const footerReasonBlock = params.footerReason
    ? `<p style="${FOOTER_TEXT_STYLE}">${escapeHtml(params.footerReason)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.appName)}</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: ${EMAIL_BRAND.pageBg};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
        sans-serif;
      color: ${EMAIL_BRAND.text};
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color: ${EMAIL_BRAND.pageBg}; padding: 32px 16px"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 480px;
              background-color: ${EMAIL_BRAND.cardBg};
              border: 1px solid ${EMAIL_BRAND.border};
            "
          >
            <tr>
              <td style="padding: 24px 24px 24px">
                <p
                  style="
                    margin: 0 0 8px;
                    font-size: 13px;
                    line-height: 20px;
                    color: ${EMAIL_BRAND.textMuted};
                  "
                >
                  ${greeting}
                </p>
                <h1
                  style="
                    margin: 0 0 16px;
                    font-size: 20px;
                    line-height: 28px;
                    font-weight: 500;
                    color: ${EMAIL_BRAND.text};
                  "
                >
                  ${escapeHtml(params.headline)}
                </h1>
                <div style="font-size: 14px; line-height: 22px; color: ${EMAIL_BRAND.textBody}">
                  ${params.bodyHtml}
                </div>
                ${ctaBlock}
                ${infoBoxBlock}
              </td>
            </tr>
          </table>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="max-width: 480px; margin-top: 20px"
          >
            <tr>
              <td style="padding: 0 8px">
                ${footerReasonBlock}
                <p style="${FOOTER_TEXT_STYLE}">
                  ${escapeHtml(companyLegalName)} &middot; ${escapeHtml(companyLocation)}
                </p>
                <p style="${FOOTER_TEXT_STYLE}">
                  &copy; ${year} ${escapeHtml(params.appName)}. All rights reserved.
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 18px; text-align: center">
                  <a
                    href="${websiteUrl}"
                    style="color: ${EMAIL_BRAND.link}; text-decoration: underline"
                  >
                    Website
                  </a>
                  &nbsp;&middot;&nbsp;
                  <a
                    href="${supportUrl}"
                    style="color: ${EMAIL_BRAND.link}; text-decoration: underline"
                  >
                    Support
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}
