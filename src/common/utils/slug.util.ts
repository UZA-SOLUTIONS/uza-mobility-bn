export function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Slug derived only from `text` (lowercase, hyphenated).
 * On collision, appends -1, -2, … — never random tokens.
 */
export async function resolveUniqueSlug(
  text: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugifyText(text);

  if (!base) {
    throw new Error('Cannot generate slug from empty text');
  }

  let slug = base;
  let attempt = 0;

  while (await isTaken(slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return slug;
}
