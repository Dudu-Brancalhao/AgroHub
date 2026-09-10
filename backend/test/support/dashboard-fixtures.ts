import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { normalizeForSearch } from '../../src/common/validation/text-normalizer';

/**
 * The worked example from specs/003-dashboard-api/data-model.md.
 *
 * The decimals are not arbitrary: 1000.11 and 500.36 are values that drift under naive
 * floating-point addition, so a total computed in JavaScript numbers rather than Decimal produces
 * 1725.4700000000003 instead of 1725.47 and the assertions below fail.
 */
export const WORKED_EXAMPLE = {
  properties: [
    { farmName: 'A', state: 'MG', totalArea: '1000.11', arableArea: '600.00', vegetationArea: '300.00' },
    { farmName: 'B', state: 'MG', totalArea: '200.00', arableArea: '100.00', vegetationArea: '50.00' },
    { farmName: 'C', state: 'SP', totalArea: '500.36', arableArea: '500.36', vegetationArea: '0.00' },
    { farmName: 'D', state: 'BA', totalArea: '25.00', arableArea: '0.00', vegetationArea: '0.00' },
  ],
  expected: {
    farms: 4,
    hectares: '1725.47',
    byState: [
      { key: 'MG', value: '1200.11' },
      { key: 'SP', value: '500.36' },
      { key: 'BA', value: '25.00' },
    ],
    arable: '1200.36',
    vegetation: '350.00',
    unclassified: '175.11',
  },
} as const;

export interface SeededWorkedExample {
  producerId: string;
  propertyIds: string[];
}

/** Inserts the worked example directly, bypassing HTTP — this is fixture setup, not a test of the API. */
export async function seedWorkedExample(prisma: PrismaClient): Promise<SeededWorkedExample> {
  const producer = await prisma.producer.create({
    data: {
      document: '52998224725',
      documentType: 'CPF',
      name: 'José Antônio',
      nameSearch: normalizeForSearch('José Antônio'),
    },
  });

  const propertyIds: string[] = [];
  for (const p of WORKED_EXAMPLE.properties) {
    const created = await prisma.property.create({
      data: {
        producerId: producer.id,
        farmName: p.farmName,
        city: 'Uberaba',
        state: p.state,
        totalArea: new Prisma.Decimal(p.totalArea),
        arableArea: new Prisma.Decimal(p.arableArea),
        vegetationArea: new Prisma.Decimal(p.vegetationArea),
      },
    });
    propertyIds.push(created.id);
  }

  return { producerId: producer.id, propertyIds };
}

const SCALE_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
const SCALE_CROPS = [
  'Soja', 'Milho', 'Cafe', 'Cana-de-acucar', 'Algodao',
  'Arroz', 'Feijao', 'Trigo', 'Sorgo', 'Girassol',
];

/**
 * Seeds the shape SC-006 names: 10,000 properties and 150,000 crops.
 *
 * The harvest count is NOT a parameter any more, and that is the point. A year identifies exactly
 * one harvest, and a valid year runs 1900 to next year, so the table can hold at most 128 rows
 * ever. The previous version asked for 50,000 harvests across five distinct years; under the
 * unique constraint it could create five, and the performance test failed on a constraint
 * violation that read like a defect in the feature rather than in its own setup
 * (research.md R-007).
 *
 * Crops are spread across property-harvest-name combinations instead:
 *   10,000 properties x 5 harvests x 10 names = 500,000 possible, so 150,000 is comfortable.
 */
export async function seedAtScale(
  prisma: PrismaClient,
  { properties = 10_000, harvests = 5, cropsPerProperty = 15 } = {},
): Promise<void> {
  const producer = await prisma.producer.create({
    data: { document: '39053344705', documentType: 'CPF', name: 'Escala', nameSearch: 'escala' },
  });

  const propertyRows = Array.from({ length: properties }, (_, i) => ({
    id: randomUUID(),
    producerId: producer.id,
    farmName: `F${i}`,
    city: 'C',
    state: SCALE_STATES[i % SCALE_STATES.length],
    totalArea: new Prisma.Decimal(`${100 + (i % 900)}.11`),
    arableArea: new Prisma.Decimal(`${50 + (i % 400)}.05`),
    vegetationArea: new Prisma.Decimal(`${20 + (i % 300)}.06`),
  }));
  for (let i = 0; i < propertyRows.length; i += 2000) {
    await prisma.property.createMany({ data: propertyRows.slice(i, i + 2000) });
  }

  // A handful of shared seasons, one row per year.
  const harvestRows = Array.from({ length: harvests }, (_, i) => ({
    id: randomUUID(),
    year: 2019 + i,
  }));
  await prisma.harvest.createMany({ data: harvestRows });

  // cropsPerProperty distinct (harvest, name) pairs per farm, so the composite unique never fires.
  const cropRows = propertyRows.flatMap((property) =>
    Array.from({ length: cropsPerProperty }, (_, k) => {
      const harvest = harvestRows[k % harvestRows.length];
      const name = SCALE_CROPS[Math.floor(k / harvestRows.length) % SCALE_CROPS.length];
      return {
        propertyId: property.id,
        harvestId: harvest.id,
        name,
        nameNormalized: normalizeForSearch(name),
      };
    }),
  );
  for (let i = 0; i < cropRows.length; i += 5000) {
    await prisma.crop.createMany({ data: cropRows.slice(i, i + 5000), skipDuplicates: true });
  }
}
