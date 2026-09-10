import { detectDocumentType, stripDocument } from './documents';

/** Display helpers. All output is pt-BR, per Principle VIII. */

export function formatCount(value: number): string {
  return value.toLocaleString('pt-BR');
}

/**
 * Dates arrive as ISO strings and stay strings everywhere except here — the store holds no Date
 * objects, so nothing non-serialisable ever enters it.
 */
export function formatDate(value: string | undefined): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Masks a digits-only document for display. Leaves anything unrecognised alone. */
export function formatDocument(value: string): string {
  const digits = stripDocument(value);
  const type = detectDocumentType(digits);

  if (type === 'CPF') {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (type === 'CNPJ') {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  return value;
}

/** Masks progressively while the user is still typing, so the field reads naturally. */
export function maskDocumentInput(value: string): string {
  const digits = stripDocument(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
