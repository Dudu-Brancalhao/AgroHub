import { formatCount, formatDate, formatDocument, pluralize } from './format';

describe('formatCount', () => {
  it('groups thousands the pt-BR way', () => {
    expect(formatCount(1000)).toBe('1.000');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234567)).toBe('1.234.567');
  });
});

describe('formatDate', () => {
  it('renders an ISO timestamp as dd/MM/yyyy', () => {
    expect(formatDate('2026-09-09T14:32:11.421Z')).toBe('09/09/2026');
  });

  it('returns an em dash when there is no date', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatDocument', () => {
  it('masks a CPF', () => {
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
  });

  it('masks a CNPJ', () => {
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('returns the input untouched when it is neither length', () => {
    expect(formatDocument('123')).toBe('123');
  });
});

describe('pluralize', () => {
  it('picks the singular for exactly one', () => {
    expect(pluralize(1, 'produtor', 'produtores')).toBe('1 produtor');
  });

  it('picks the plural for everything else', () => {
    expect(pluralize(0, 'produtor', 'produtores')).toBe('0 produtores');
    expect(pluralize(3, 'produtor', 'produtores')).toBe('3 produtores');
  });
});
