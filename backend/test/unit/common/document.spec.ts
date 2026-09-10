import {
  detectDocumentType,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  normalizeDocument,
} from '../../../src/common/validation/document';
import {
  BAD_CHECK_DIGIT,
  FORMATTED_EQUIVALENTS,
  REPEATED_DIGIT,
  VALID_CNPJS,
  VALID_CPFS,
  WRONG_LENGTH,
} from '../../support/document-fixtures';

describe('Document validation (FR-005, FR-006)', () => {
  describe('normalizeDocument', () => {
    it.each(FORMATTED_EQUIVALENTS)('reduces %p to %p', (formatted, digits) => {
      expect(normalizeDocument(formatted)).toBe(digits);
    });
  });

  describe('valid documents', () => {
    it.each(VALID_CPFS)('accepts CPF %s', (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
      expect(isValidDocument(cpf)).toBe(true);
      expect(detectDocumentType(cpf)).toBe('CPF');
    });

    it.each(VALID_CNPJS)('accepts CNPJ %s', (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true);
      expect(isValidDocument(cnpj)).toBe(true);
      expect(detectDocumentType(cnpj)).toBe('CNPJ');
    });

    it('accepts a valid document regardless of punctuation', () => {
      expect(isValidDocument('529.982.247-25')).toBe(true);
      expect(isValidDocument('  529.982.247-25 ')).toBe(true);
      expect(isValidDocument('11.222.333/0001-81')).toBe(true);
    });
  });

  /**
   * The case that matters most. `111.111.111-11` PASSES the check-digit arithmetic — every
   * weighted sum works out — so it is excluded by the explicit repeated-digit rule or not at all.
   * A great many naive implementations accept it (FR-006).
   */
  describe('repeated-digit documents', () => {
    it.each(REPEATED_DIGIT)('rejects %s even though its checksum computes', (doc) => {
      expect(isValidDocument(doc)).toBe(false);
    });
  });

  describe('invalid documents', () => {
    it.each(BAD_CHECK_DIGIT)('rejects %s (bad check digit)', (doc) => {
      expect(isValidDocument(doc)).toBe(false);
    });

    it.each(WRONG_LENGTH)('rejects %p (wrong length)', (doc) => {
      expect(isValidDocument(doc)).toBe(false);
    });

    it('rejects non-numeric input rather than throwing', () => {
      expect(isValidDocument('abcdefghijk')).toBe(false);
      expect(isValidDocument(undefined as unknown as string)).toBe(false);
    });

    it('never pads or guesses a short number into a CPF', () => {
      expect(isValidDocument('5299822472')).toBe(false);
      expect(() => detectDocumentType('5299822472')).toThrow();
    });
  });
});
