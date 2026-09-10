/**
 * CPF and CNPJ check-digit validation.
 *
 * This exists only to give immediate feedback before submitting (FR-027). The server remains the
 * authority — in particular, uniqueness is never checked here; the server's 409 is surfaced
 * against the document field instead (FR-030).
 */

export type DocumentType = 'CPF' | 'CNPJ';

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

export function stripDocument(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * A document made of one repeated digit passes a plain modulus check, so it needs its own guard.
 * `111.111.111-11` is the canonical example.
 */
function isRepeatedDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
  const digits = stripDocument(value);
  if (digits.length !== CPF_LENGTH || isRepeatedDigits(digits)) return false;

  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = stripDocument(value);
  if (digits.length !== CNPJ_LENGTH || isRepeatedDigits(digits)) return false;

  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === Number(digits[12]) && second === Number(digits[13]);
}

/** The type the server would derive, read from the digit count alone. */
export function detectDocumentType(value: string): DocumentType | null {
  const digits = stripDocument(value);
  if (digits.length === CPF_LENGTH) return 'CPF';
  if (digits.length === CNPJ_LENGTH) return 'CNPJ';
  return null;
}

export function isValidDocument(value: string): boolean {
  const type = detectDocumentType(value);
  if (type === 'CPF') return isValidCpf(value);
  if (type === 'CNPJ') return isValidCnpj(value);
  return false;
}
