import { DocumentType } from '@prisma/client';

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

/**
 * CPF and CNPJ check-digit validation.
 *
 * Written here rather than installed: the algorithm is fixed by law, is about forty lines, and
 * sits on the path of every producer write — a poor place for a small, single-purpose dependency
 * that can be abandoned or hijacked (research.md R-002).
 *
 * Keeping every rule in this one file is also what makes the alphanumeric-CNPJ change of R-003 a
 * single-file edit if and when it is needed.
 */

/** Strips punctuation and whitespace, leaving digits only (FR-007). */
export function normalizeDocument(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Rejects documents made of a single repeated digit.
 *
 * This is NOT redundant with the checksum. `111.111.111-11` *passes* the check-digit arithmetic —
 * every weighted sum works out — which is exactly why so many implementations accept it. It is
 * excluded by an explicit rule or not at all (FR-006).
 */
function isRepeatedDigits(digits: string): boolean {
  return /^(\d)\1*$/.test(digits);
}

export function isValidCpf(raw: string): boolean {
  const digits = normalizeDocument(raw);
  if (digits.length !== CPF_LENGTH || isRepeatedDigits(digits)) {
    return false;
  }

  const checkDigit = (upTo: number): number => {
    let sum = 0;
    for (let i = 0; i < upTo; i += 1) {
      sum += Number(digits[i]) * (upTo + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

export function isValidCnpj(raw: string): boolean {
  const digits = normalizeDocument(raw);
  if (digits.length !== CNPJ_LENGTH || isRepeatedDigits(digits)) {
    return false;
  }

  const weightsFor = (upTo: number): number[] =>
    upTo === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const checkDigit = (upTo: number): number => {
    const weights = weightsFor(upTo);
    let sum = 0;
    for (let i = 0; i < upTo; i += 1) {
      sum += Number(digits[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

export function isValidDocument(raw: string): boolean {
  const digits = normalizeDocument(raw);
  if (digits.length === CPF_LENGTH) {
    return isValidCpf(digits);
  }
  if (digits.length === CNPJ_LENGTH) {
    return isValidCnpj(digits);
  }
  // Any other length is neither document. Never pad, never guess (FR-005).
  return false;
}

/**
 * Derives the document type from its length. Only call this on a document that already validated —
 * it throws otherwise rather than guessing, so a bad value cannot be silently stored as a CPF.
 */
export function detectDocumentType(raw: string): DocumentType {
  const digits = normalizeDocument(raw);
  if (digits.length === CPF_LENGTH) {
    return DocumentType.CPF;
  }
  if (digits.length === CNPJ_LENGTH) {
    return DocumentType.CNPJ;
  }
  throw new Error(`Cannot determine document type for a value of length ${digits.length}`);
}
