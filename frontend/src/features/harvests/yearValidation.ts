import { MIN_HARVEST_YEAR, maxHarvestYear } from './types';

/**
 * FR-039. The upper bound is computed at call time from the current year, matching the server's
 * `isPlausibleHarvestYear` — hard-coding it would start rejecting valid years on 1 January.
 */
export function validateHarvestYear(raw: string, now: Date = new Date()): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 'Informe o ano da safra.';

  if (!/^\d+$/.test(trimmed)) return 'O ano da safra deve ser um número inteiro.';

  const year = Number(trimmed);
  if (year < MIN_HARVEST_YEAR || year > maxHarvestYear(now)) {
    return `Informe um ano entre ${MIN_HARVEST_YEAR} e ${maxHarvestYear(now)}.`;
  }

  return null;
}
