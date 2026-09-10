import {
  detectDocumentType,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  stripDocument,
} from './documents';

describe('stripDocument', () => {
  it('removes punctuation and whitespace', () => {
    expect(stripDocument('529.982.247-25')).toBe('52998224725');
    expect(stripDocument(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });
});

describe('isValidCpf', () => {
  it('accepts a CPF with correct check digits', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejects wrong check digits', () => {
    expect(isValidCpf('52998224726')).toBe(false);
  });

  /**
   * Repeated digits satisfy a naive checksum, which is why they need their own guard
   * (research.md R-010). Every one of these would pass a modulus check alone.
   */
  it.each([
    '00000000000',
    '11111111111',
    '22222222222',
    '99999999999',
  ])('rejects the repeated-digit document %s', (document) => {
    expect(isValidCpf(document)).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247251')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('accepts a CNPJ with correct check digits', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejects wrong check digits', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
  });

  it('rejects repeated digits', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
  });
});

describe('detectDocumentType', () => {
  it('reads the type from the digit count', () => {
    expect(detectDocumentType('52998224725')).toBe('CPF');
    expect(detectDocumentType('11222333000181')).toBe('CNPJ');
  });

  it('returns null for anything else', () => {
    expect(detectDocumentType('123')).toBeNull();
    expect(detectDocumentType('')).toBeNull();
  });
});

describe('isValidDocument', () => {
  it('accepts either a valid CPF or a valid CNPJ', () => {
    expect(isValidDocument('529.982.247-25')).toBe(true);
    expect(isValidDocument('11.222.333/0001-81')).toBe(true);
  });

  it('refuses anything that is neither', () => {
    expect(isValidDocument('111.111.111-11')).toBe(false);
    expect(isValidDocument('12345')).toBe(false);
    expect(isValidDocument('')).toBe(false);
  });
});
