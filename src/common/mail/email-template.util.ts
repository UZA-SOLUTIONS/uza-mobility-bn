/** UZA Mobility brand palette (aligned with marketplace/admin apps). */
export const EMAIL_BRAND = {
  forest: '#174438',
  teal: '#356769',
  lime: '#AAFF47',
  pageBg: '#f4f7f9',
  cardBg: '#ffffff',
  text: '#1f2937',
  textMuted: '#6b7280',
  textBody: '#4b5563',
  border: '#e5e7eb',
  infoBg: '#f9fafb',
  footerText: '#9ca3af',
  white: '#ffffff',
} as const;

export type BrandedEmailParams = {
  appName: string;
  tagline: string;
  logoUrl: string;
  recipientName?: string;
  headline: string;
  bodyHtml: string;
  actionUrl?: string;
  actionLabel?: string;
  infoBoxHtml?: string;
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

export function buildBrandedEmailHtml(params: BrandedEmailParams): string {
  const year = params.year ?? new Date().getFullYear();
  const greeting = params.recipientName
    ? `Hello <strong>${escapeHtml(params.recipientName)}</strong>,`
    : 'Hello,';

  const ctaBlock =
    params.actionUrl && params.actionLabel
      ? `
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin: 32px 0"
                >
                  <tr>
                    <td align="center">
                      <a
                        href="${params.actionUrl}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 16px 32px;
                          background-color: ${EMAIL_BRAND.forest};
                          color: ${EMAIL_BRAND.white};
                          text-decoration: none;
                          border-radius: 10px;
                          font-size: 15px;
                          font-weight: bold;
                        "
                      >
                        ${escapeHtml(params.actionLabel)}
                      </a>
                    </td>
                  </tr>
                </table>`
      : '';

  const infoBoxBlock = params.infoBoxHtml
    ? `
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background-color: ${EMAIL_BRAND.infoBg};
                    border-left: 4px solid ${EMAIL_BRAND.lime};
                    border-radius: 12px;
                    margin-top: 24px;
                  "
                >
                  <tr>
                    <td style="padding: 20px">
                      <p
                        style="
                          margin: 0;
                          font-size: 15px;
                          line-height: 26px;
                          color: ${EMAIL_BRAND.textBody};
                        "
                      >
                        ${params.infoBoxHtml}
                      </p>
                    </td>
                  </tr>
                </table>`
    : '';

  const websiteUrl = params.websiteUrl ?? '#';
  const supportUrl = params.supportUrl ?? websiteUrl;

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
      font-family: Arial, Helvetica, sans-serif;
      color: ${EMAIL_BRAND.text};
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color: ${EMAIL_BRAND.pageBg}; padding: 40px 16px"
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
              max-width: 640px;
              background-color: ${EMAIL_BRAND.cardBg};
              border-radius: 18px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            "
          >
            <tr>
              <td
                align="center"
                style="
                  background: linear-gradient(135deg, ${EMAIL_BRAND.forest}, ${EMAIL_BRAND.teal});
                  padding: 40px 24px;
                "
              >
                <img
                  src="${params.logoUrl}"
                  alt="${escapeHtml(params.appName)}"
                  width="220"
                  style="display: block; max-width: 100%; height: auto"
                />
                <p
                  style="
                    margin: 16px 0 0;
                    color: ${EMAIL_BRAND.lime};
                    font-size: 15px;
                    line-height: 24px;
                  "
                >
                  ${escapeHtml(params.tagline)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 48px 36px">
                <p
                  style="
                    margin: 0 0 12px;
                    font-size: 16px;
                    color: ${EMAIL_BRAND.textMuted};
                  "
                >
                  ${greeting}
                </p>
                <h1
                  style="
                    margin: 0 0 20px;
                    font-size: 30px;
                    line-height: 40px;
                    color: ${EMAIL_BRAND.forest};
                  "
                >
                  ${escapeHtml(params.headline)}
                </h1>
                <div
                  style="
                    margin: 0 0 18px;
                    font-size: 16px;
                    line-height: 28px;
                    color: ${EMAIL_BRAND.textBody};
                  "
                >
                  ${params.bodyHtml}
                </div>
                ${ctaBlock}
                ${infoBoxBlock}
                <hr
                  style="
                    border: none;
                    border-top: 1px solid ${EMAIL_BRAND.border};
                    margin: 40px 0;
                  "
                />
                <p
                  style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 24px;
                    color: ${EMAIL_BRAND.textMuted};
                  "
                >
                  Best regards,<br />
                  <strong>${escapeHtml(params.appName)} Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td
                align="center"
                style="
                  padding: 28px 24px;
                  background-color: ${EMAIL_BRAND.forest};
                  color: ${EMAIL_BRAND.footerText};
                  font-size: 13px;
                  line-height: 22px;
                "
              >
                &copy; ${year} ${escapeHtml(params.appName)}. All rights reserved.
                <br />
                Kigali, Rwanda
                <br /><br />
                <a
                  href="${websiteUrl}"
                  style="color: ${EMAIL_BRAND.white}; text-decoration: none"
                >
                  Visit Website
                </a>
                &nbsp; &bull; &nbsp;
                <a
                  href="${supportUrl}"
                  style="color: ${EMAIL_BRAND.white}; text-decoration: none"
                >
                  Support
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}
