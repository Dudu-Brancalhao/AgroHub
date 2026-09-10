import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { detectDocumentType } from '../src/common/validation/document';
import { normalizeForSearch } from '../src/common/validation/text-normalizer';

/**
 * Demo data for the dashboard.
 *
 * Two rules shape everything below.
 *
 * 1. The derived columns are DERIVED, never typed by hand. `nameSearch`, `nameNormalized` and
 *    `documentType` are computed here with the very functions the API uses, because they are
 *    written by the repository layer in normal operation and the database has no default for
 *    them. A seed that hand-wrote "jose" would work until someone searched for "José" — the
 *    search index and the duplicate check both read these columns.
 *
 * 2. Every area is a `Prisma.Decimal` built from a STRING. `new Prisma.Decimal(1500.11)` parses a
 *    float first and inherits its error; the string constructor does not. The totals below are
 *    exact on purpose, so the dashboard is checkable by hand.
 *
 * Re-running is safe: every write is an upsert keyed on something unique, so the seed converges
 * on the same rows rather than piling up duplicates or wiping data you added yourself.
 */

const prisma = new PrismaClient();

/**
 * Properties have no natural unique key — two farms may share a name — so their ids are fixed
 * here. That is what makes the seed idempotent for them.
 */
const PRODUCERS = [
  {
    document: '14725836982',
    name: 'José Antônio de Almeida',
    property: {
      id: '11111111-1111-4111-8111-111111111111',
      farmName: 'Fazenda Santa Helena',
      city: 'Uberaba',
      state: 'MG',
      totalArea: '1500.11',
      arableArea: '1000.00',
      vegetationArea: '500.11',
    },
  },
  {
    document: '20481573607',
    name: 'Maria Fernanda Souza',
    property: {
      id: '22222222-2222-4222-8222-222222222222',
      farmName: 'Sítio Boa Esperança',
      city: 'Ribeirão Preto',
      state: 'SP',
      totalArea: '850.50',
      arableArea: '600.25',
      vegetationArea: '200.25',
    },
  },
  {
    document: '41802539000141',
    name: 'Agropecuária Vale Verde LTDA',
    property: {
      id: '33333333-3333-4333-8333-333333333333',
      farmName: 'Fazenda Vale Verde',
      city: 'Barreiras',
      state: 'BA',
      totalArea: '2300.00',
      arableArea: '1800.00',
      vegetationArea: '400.00',
    },
  },
  {
    document: '31852709405',
    name: 'Carlos Eduardo Ribeiro',
    property: {
      id: '44444444-4444-4444-8444-444444444444',
      farmName: 'Estância do Cerrado',
      city: 'Rio Verde',
      state: 'GO',
      totalArea: '640.36',
      arableArea: '640.36',
      vegetationArea: '0.00',
    },
  },
  {
    document: '62719348000190',
    name: 'Fazendas Reunidas do Cerrado S.A.',
    property: {
      id: '55555555-5555-4555-8555-555555555555',
      farmName: 'Fazenda Nova Fronteira',
      city: 'Sorriso',
      state: 'MT',
      totalArea: '120.03',
      arableArea: '80.00',
      vegetationArea: '40.03',
    },
  },
] as const;

const HARVEST_YEARS = [2021, 2022] as const;

/**
 * Six plantings across four farms — chosen so the dashboard shows something worth looking at
 * rather than five identical slices:
 *
 * - Santa Helena plants soja in BOTH seasons, so soja counts twice for ONE farm. That is the
 *   difference between counting plantings and counting farms, and it is invisible in data where
 *   every farm appears once.
 * - Nova Fronteira (MT) plants nothing, so it counts in `totals` and `byState` but is absent
 *   from `byCrop` — the other case that only shows up in deliberately uneven data.
 */
const CROPS = [
  { property: '11111111-1111-4111-8111-111111111111', year: 2021, name: 'Soja' },
  { property: '11111111-1111-4111-8111-111111111111', year: 2022, name: 'Soja' },
  { property: '11111111-1111-4111-8111-111111111111', year: 2021, name: 'Milho' },
  { property: '22222222-2222-4222-8222-222222222222', year: 2021, name: 'Soja' },
  { property: '33333333-3333-4333-8333-333333333333', year: 2022, name: 'Café' },
  { property: '44444444-4444-4444-8444-444444444444', year: 2021, name: 'Algodão' },
] as const;

async function seedDemoUser(): Promise<string | null> {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;

  // Deliberately not defaulted. A seed that ships a known email and password creates a real
  // account with a publicly known credential the moment this runs anywhere but a laptop, and
  // "it is only the demo data" is how that gets left in place (Constitution V).
  if (!email || !password) {
    return null;
  }

  const cost = Number(process.env.BCRYPT_COST ?? 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash(password, cost) },
  });

  return user.email;
}

/**
 * Clears the registry so the demo is exactly the five producers below and nothing else.
 *
 * Off by default, because a seed that silently deletes is a seed that eventually deletes
 * something you wanted. Users are never touched — losing the account you log in with would make
 * the seeded dashboard unreachable.
 *
 * The order is forced by the schema: crops reference harvests with ON DELETE RESTRICT, so the
 * crops must go first or the harvest delete is refused. Properties are not listed because
 * deleting a producer cascades to them.
 */
async function reset(): Promise<void> {
  await prisma.crop.deleteMany();
  await prisma.harvest.deleteMany();
  await prisma.producer.deleteMany();
  console.log('Registry cleared (SEED_RESET=true). Users were left alone.');
}

async function main(): Promise<void> {
  if (process.env.SEED_RESET === 'true') {
    await reset();
  }

  const harvests = new Map<number, string>();
  for (const year of HARVEST_YEARS) {
    // Upserted on the year, which is what identifies a harvest now: the seed adopts a season the
    // registry already has rather than failing on the unique constraint.
    const harvest = await prisma.harvest.upsert({
      where: { year },
      update: {},
      create: { year },
    });
    harvests.set(year, harvest.id);
  }

  for (const entry of PRODUCERS) {
    const producer = await prisma.producer.upsert({
      where: { document: entry.document },
      update: { name: entry.name, nameSearch: normalizeForSearch(entry.name) },
      create: {
        document: entry.document,
        documentType: detectDocumentType(entry.document),
        name: entry.name,
        nameSearch: normalizeForSearch(entry.name),
      },
    });

    const p = entry.property;
    const areas = {
      totalArea: new Prisma.Decimal(p.totalArea),
      arableArea: new Prisma.Decimal(p.arableArea),
      vegetationArea: new Prisma.Decimal(p.vegetationArea),
    };

    await prisma.property.upsert({
      where: { id: p.id },
      update: { ...areas, farmName: p.farmName, city: p.city, state: p.state },
      create: {
        id: p.id,
        producerId: producer.id,
        farmName: p.farmName,
        city: p.city,
        state: p.state,
        ...areas,
      },
    });
  }

  for (const crop of CROPS) {
    const harvestId = harvests.get(crop.year);
    if (!harvestId) {
      throw new Error(`No harvest seeded for ${crop.year}`);
    }

    const nameNormalized = normalizeForSearch(crop.name);
    await prisma.crop.upsert({
      // The composite unique IS the identity of a planting: one farm, one season, one crop.
      where: {
        propertyId_harvestId_nameNormalized: {
          propertyId: crop.property,
          harvestId,
          nameNormalized,
        },
      },
      update: {},
      create: { propertyId: crop.property, harvestId, name: crop.name, nameNormalized },
    });
  }

  const demoUser = await seedDemoUser();
  await report(demoUser);
}

/**
 * Prints what the dashboard should now show, read back from the database.
 *
 * Not decoration: a seed whose numbers are only asserted in a comment is a seed nobody checks.
 * Reading the totals back means a mistake in the fixture shows up here rather than as a puzzling
 * chart later.
 */
async function report(demoUser: string | null): Promise<void> {
  const [producers, properties, harvestCount, crops] = await Promise.all([
    prisma.producer.count(),
    prisma.property.count(),
    prisma.harvest.count(),
    prisma.crop.count(),
  ]);

  const areas = await prisma.property.aggregate({
    _sum: { totalArea: true, arableArea: true, vegetationArea: true },
  });

  const total = areas._sum.totalArea ?? new Prisma.Decimal(0);
  const arable = areas._sum.arableArea ?? new Prisma.Decimal(0);
  const vegetation = areas._sum.vegetationArea ?? new Prisma.Decimal(0);

  const byCrop = await prisma.crop.groupBy({
    by: ['nameNormalized'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // Whole-database counts, not the seed's own contribution. When they differ from the fixture
  // there is other data present, and saying so is the difference between "the dashboard looks
  // wrong" and "of course, my test producer is still in there".
  const expected = {
    producers: PRODUCERS.length,
    properties: PRODUCERS.length,
    harvests: HARVEST_YEARS.length,
    crops: CROPS.length,
  };
  const extra =
    producers > expected.producers ||
    properties > expected.properties ||
    harvestCount > expected.harvests ||
    crops > expected.crops;

  console.log('\nSeed complete.\n');
  console.log(
    `  producers   ${producers}${producers === expected.producers ? '' : ` (seed defines ${expected.producers})`}`,
  );
  console.log(
    `  properties  ${properties}${properties === expected.properties ? '' : ` (seed defines ${expected.properties})`}`,
  );
  console.log(
    `  harvests    ${harvestCount}${harvestCount === expected.harvests ? '' : ` (seed defines ${expected.harvests})`}`,
  );
  console.log(
    `  crops       ${crops}${crops === expected.crops ? '' : ` (seed defines ${expected.crops})`}`,
  );

  if (extra) {
    console.log(
      '\n  The database holds rows this seed did not create. Re-run with SEED_RESET=true',
    );
    console.log('  to clear the registry first and get exactly the demo set.');
  }
  console.log('\nGET /api/dashboard should now report:\n');
  console.log(`  totals.farms      ${properties}`);
  console.log(`  totals.hectares   ${total.toFixed(2)}`);
  console.log(
    `  byLandUse         arable ${arable.toFixed(2)} | vegetation ${vegetation.toFixed(2)} | unclassified ${total.minus(arable).minus(vegetation).toFixed(2)}`,
  );
  console.log(
    `  byCrop            ${byCrop.map((c) => `${c.nameNormalized}=${c._count._all}`).join(', ')}`,
  );
  console.log(
    `\n  byCrop sums to ${crops} across ${properties} farms — different quantities, as the field \`unit\` says.`,
  );

  if (demoUser) {
    console.log(`\n  demo user   ${demoUser} (password from SEED_USER_PASSWORD)`);
  } else {
    console.log('\n  No demo user created. Set SEED_USER_EMAIL and SEED_USER_PASSWORD to add one.');
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
