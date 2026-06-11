/** Canonical email form for auth lookups and storage. */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}
