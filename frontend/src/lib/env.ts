/**
 * Every environment value the app reads, in one place.
 *
 * Vite inlines `import.meta.env` at build time, so a missing variable is a silent
 * `undefined` that surfaces as a broken request in production. Reading them here
 * means a missing one is a named default, not a mystery.
 */
export const env = {
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? '/api',
  environment: import.meta.env['VITE_ENVIRONMENT'] ?? 'development',
  isProduction: import.meta.env['VITE_ENVIRONMENT'] === 'production',
} as const;
