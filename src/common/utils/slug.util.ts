import { randomBytes } from 'crypto';

export function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateListingSlug(
  brand: string,
  model: string,
  year: number,
): string {
  const base = slugifyText(`${brand}-${model}-${year}`);
  const suffix = randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

export function generateSubcategorySlug(name: string): string {
  const base = slugifyText(name);
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}
