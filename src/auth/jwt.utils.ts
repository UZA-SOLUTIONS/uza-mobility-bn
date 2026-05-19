import { genSaltSync, hashSync, compareSync } from 'bcryptjs';

export function hashPassword(password: string): string {
  const salt = genSaltSync(10);
  return hashSync(password, salt);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  return compareSync(password, storedHash);
}
