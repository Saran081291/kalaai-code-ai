export const JOIN_CODE_LENGTH = 8;

/** Uppercase, alphanumeric only, max 8 chars. */
export function normalizeJoinCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, JOIN_CODE_LENGTH);
}

export function isValidJoinCode(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${JOIN_CODE_LENGTH}}$`).test(code);
}
