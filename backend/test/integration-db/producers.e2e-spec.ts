import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DbTestApp, createDbTestApp } from '../support/create-db-test-app';
import {
  BAD_CHECK_DIGIT,
  REPEATED_DIGIT,
  VALID_CNPJS,
  VALID_CPFS,
  WRONG_LENGTH,
} from '../support/document-fixtures';

describe('Producers (US1, US4, US5)', () => {
  let ctx: DbTestApp;
  let app: INestApplication;
  let auth: string;

  beforeAll(async () => {
    ctx = await createDbTestApp();
    app = ctx.app;
    auth = await ctx.authHeader();
  });

  afterAll(async () => {
    await ctx.truncate();
    await app.close();
    await ctx.prisma.$disconnect();
  });

  beforeEach(() => ctx.truncate());

  const create = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/producers').set('Authorization', auth).send(body);

  // ---- FR-001 -----------------------------------------------------------------------------

  it('refuses every route without a token, with no auth code of its own', async () => {
    await request(app.getHttpServer()).get('/api/producers').expect(401);
    await request(app.getHttpServer()).post('/api/producers').send({}).expect(401);
    await request(app.getHttpServer())
      .get('/api/producers/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  // ---- US1 --------------------------------------------------------------------------------

  it('creates a producer from a CPF (spec US1 §1)', async () => {
    const res = await create({ document: '529.982.247-25', name: 'José Antônio de Almeida' });

    expect(res.status).toBe(201);
    expect(res.body.document).toBe('52998224725');
    expect(res.body.documentType).toBe('CPF');
    // Exact key set: nameSearch must never leak, and a future column must fail this test.
    expect(Object.keys(res.body).sort()).toEqual([
      'createdAt',
      'document',
      'documentType',
      'id',
      'name',
      'updatedAt',
    ]);
  });

  it('creates a producer from a CNPJ (spec US1 §4)', async () => {
    const res = await create({ document: '11.222.333/0001-81', name: 'Agropecuária Boa Vista' });
    expect(res.status).toBe(201);
    expect(res.body.documentType).toBe('CNPJ');
    expect(res.body.document).toBe(VALID_CNPJS[0]);
  });

  it('rejects a duplicate document however it is punctuated (spec US1 §2)', async () => {
    await create({ document: '529.982.247-25', name: 'Primeiro' }).expect(201);

    const res = await create({ document: '52998224725', name: 'Segundo' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Já existe um produtor cadastrado com este documento.');
    expect(await ctx.prisma.producer.count()).toBe(1);
  });

  it.each([...REPEATED_DIGIT, ...BAD_CHECK_DIGIT, ...WRONG_LENGTH])(
    'rejects invalid document %p (spec US1 §3)',
    async (document) => {
      const res = await create({ document, name: 'Teste' });
      expect(res.status).toBe(400);
      expect(await ctx.prisma.producer.count()).toBe(0);
    },
  );

  it('rejects a blank name and a missing document together (spec US1 §5)', async () => {
    const res = await create({ name: '  ' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['document', 'name']));
  });

  it('rejects unknown fields rather than dropping them (FR-036)', async () => {
    const res = await create({ document: VALID_CPFS[0], name: 'Teste', role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain('role');
  });

  // ---- US4 --------------------------------------------------------------------------------

  describe('listing and search', () => {
    beforeEach(async () => {
      await create({ document: '529.982.247-25', name: 'José Antônio de Almeida' }).expect(201);
      await create({ document: '390.533.447-05', name: 'Maria da Silva' }).expect(201);
      await create({ document: '11.222.333/0001-81', name: 'Agropecuária Boa Vista' }).expect(201);
    });

    const list = (query: string) =>
      request(app.getHttpServer()).get(`/api/producers${query}`).set('Authorization', auth);

    it('returns a page with the total beyond it (spec US4 §1)', async () => {
      const res = await list('?page=1&pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
    });

    it('pages without duplicates or gaps (spec US4 §2)', async () => {
      const first = await list('?page=1&pageSize=2');
      const second = await list('?page=2&pageSize=2');

      const ids = [...first.body.data, ...second.body.data].map((p: { id: string }) => p.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    });

    it('rejects a pageSize above the cap', async () => {
      await list('?pageSize=500').expect(400);
    });

    // FR-027: the whole point of the nameSearch column.
    it.each(['jose', 'JOSÉ', 'José', 'antonio', 'ANTÔNIO'])(
      'finds "José Antônio" by searching %p',
      async (term) => {
        const res = await list(`?search=${encodeURIComponent(term)}`);
        expect(res.status).toBe(200);
        expect(res.body.data.map((p: { name: string }) => p.name)).toContain(
          'José Antônio de Almeida',
        );
      },
    );

    it('searches by document with or without punctuation', async () => {
      for (const term of ['52998224725', '529.982']) {
        const res = await list(`?search=${encodeURIComponent(term)}`);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].document).toBe('52998224725');
      }
    });

    it('returns an empty page rather than an error when nothing matches', async () => {
      const res = await list('?search=inexistente');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  it('answers a missing producer with 404, not an empty success (spec US4 §5)', async () => {
    await request(app.getHttpServer())
      .get('/api/producers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', auth)
      .expect(404);
  });

  // ---- US5 --------------------------------------------------------------------------------

  describe('updates', () => {
    it('renames a producer and leaves the document untouched (spec US5 §1)', async () => {
      const created = await create({ document: '529.982.247-25', name: 'José Antônio' });

      const res = await request(app.getHttpServer())
        .patch(`/api/producers/${created.body.id}`)
        .set('Authorization', auth)
        .send({ name: 'José A. de Almeida' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('José A. de Almeida');
      expect(res.body.document).toBe('52998224725');
    });

    it('re-derives the search key on rename, so search follows the new name', async () => {
      const created = await create({ document: '529.982.247-25', name: 'José Antônio' });
      await request(app.getHttpServer())
        .patch(`/api/producers/${created.body.id}`)
        .set('Authorization', auth)
        .send({ name: 'Benedito Câmara' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/producers?search=camara')
        .set('Authorization', auth);
      expect(res.body.data).toHaveLength(1);

      const stale = await request(app.getHttpServer())
        .get('/api/producers?search=jose')
        .set('Authorization', auth);
      expect(stale.body.data).toHaveLength(0);
    });

    it('refuses a document already used by another producer (spec US5 §2)', async () => {
      await create({ document: '529.982.247-25', name: 'Primeiro' }).expect(201);
      const second = await create({ document: '390.533.447-05', name: 'Segundo' });

      const res = await request(app.getHttpServer())
        .patch(`/api/producers/${second.body.id}`)
        .set('Authorization', auth)
        .send({ document: '529.982.247-25' });

      expect(res.status).toBe(409);
    });

    it('rejects an update to an unknown producer (spec US5 §7)', async () => {
      await request(app.getHttpServer())
        .patch('/api/producers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth)
        .send({ name: 'X' })
        .expect(404);
    });
  });
});
