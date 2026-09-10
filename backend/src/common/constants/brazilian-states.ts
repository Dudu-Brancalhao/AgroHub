/**
 * The 27 federative units of Brazil (26 states plus the Federal District).
 *
 * A constant rather than a database table or a Prisma enum: the list has not changed since 1988
 * and cannot change without a constitutional amendment, so a table would add a join and a seed
 * for no benefit, and an enum would make any future change a migration.
 */
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];
