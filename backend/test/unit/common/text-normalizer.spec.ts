import {
  normalizeDisplayText,
  normalizeForSearch,
} from '../../../src/common/validation/text-normalizer';

describe('normalizeForSearch (FR-025, FR-027)', () => {
  it.each([
    ['José Antônio', 'jose antonio'],
    ['SOJA', 'soja'],
    ['  Milho  safrinha ', 'milho safrinha'],
    ['Açaí', 'acai'],
    ['São Paulo', 'sao paulo'],
    ['Café', 'cafe'],
  ])('reduces %p to %p', (input, expected) => {
    expect(normalizeForSearch(input)).toBe(expected);
  });

  it('is idempotent, so re-deriving a stored key never changes it', () => {
    const once = normalizeForSearch('José Antônio');
    expect(normalizeForSearch(once)).toBe(once);
  });

  it('collapses accent and case differences onto one key', () => {
    const key = normalizeForSearch('Soja');
    expect(normalizeForSearch('soja')).toBe(key);
    expect(normalizeForSearch('  SOJA  ')).toBe(key);
  });

  it('keeps genuinely different words apart', () => {
    expect(normalizeForSearch('Soja')).not.toBe(normalizeForSearch('Soya'));
  });
});

describe('normalizeDisplayText (FR-009, FR-024)', () => {
  it('trims and collapses without touching capitalisation', () => {
    expect(normalizeDisplayText('  José   Antônio ')).toBe('José Antônio');
  });
});
