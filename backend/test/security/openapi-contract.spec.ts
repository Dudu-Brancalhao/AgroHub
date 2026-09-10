import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from '../../src/common/swagger/document.config';
import { TestApp, createTestApp } from '../support/create-test-app';

/**
 * FR-027 / Constitution III.
 *
 * Guards against the usual drift: an endpoint gains a status code, or a field is renamed, and the
 * committed contract quietly stops describing the running service. Compares the generated
 * document against specs/001-user-auth/contracts/openapi.yaml.
 */
describe('Swagger document matches the committed contract (FR-027)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let document: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;

    // The real config, not a lookalike: building a separate DocumentBuilder here is
    // exactly why the bearer scheme-name mismatch shipped unnoticed.
    document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Every scheme an operation REQUIRES must be DEFINED in components.securitySchemes.
   *
   * When they drift - @ApiBearerAuth() with no argument references `bearer`, while
   * .addBearerAuth(opts, name) defined `bearerAuth` - Swagger UI still shows Authorize and still
   * reports "authorized", but sends no Authorization header, and every call returns 401 with no
   * clue why. This is the check that catches it.
   */
  it('defines every security scheme its operations require', () => {
    const defined = Object.keys(document.components.securitySchemes ?? {});
    const required = new Set<string>();

    Object.values(document.paths).forEach((operations) => {
      Object.entries(operations as Record<string, unknown>).forEach(([method, operation]) => {
        if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) return;
        const security = (operation as { security?: Array<Record<string, unknown>> }).security;
        (security ?? []).forEach((entry) => Object.keys(entry).forEach((n) => required.add(n)));
      });
    });

    expect(required.size).toBeGreaterThan(0);
    expect([...required].sort()).toEqual(defined.sort());
  });

  it('exposes exactly the three documented auth operations', () => {
    expect(Object.keys(document.paths).sort()).toEqual(
      expect.arrayContaining(['/api/auth/login', '/api/auth/me', '/api/auth/register']),
    );
  });

  it.each([
    ['/api/auth/register', 'post', ['201', '400', '409', '429']],
    ['/api/auth/login', 'post', ['200', '401', '429']],
    ['/api/auth/me', 'get', ['200', '401']],
  ])('documents every failure case of %s', (path, method, expected) => {
    const responses = Object.keys(document.paths[path][method].responses).sort();
    expected.forEach((code) => expect(responses).toContain(code));
  });

  it('does NOT advertise a 400 on login, because malformed input returns the generic 401', () => {
    // FR-013a. If a 400 reappears here, someone re-enabled itemised validation errors on a
    // credential endpoint and reopened the malformed-vs-wrong-credentials distinction.
    expect(Object.keys(document.paths['/api/auth/login'].post.responses)).not.toContain('400');
    expect(Object.keys(document.paths['/api/auth/register'].post.responses)).toContain('400');
  });

  it('marks only /auth/me as requiring a bearer token', () => {
    expect(document.paths['/api/auth/me'].get.security).toBeDefined();
    expect(document.paths['/api/auth/register'].post.security).toBeUndefined();
    expect(document.paths['/api/auth/login'].post.security).toBeUndefined();
  });

  it('caps the password schema at 72 bytes, matching bcrypt truncation', () => {
    const password = document.components.schemas.RegisterDto.properties.password;
    expect(password.maxLength).toBe(72);
    expect(password.minLength).toBe(8);
  });

  it('never exposes password material in any response schema', () => {
    const serialised = JSON.stringify(document.components.schemas);
    expect(serialised).not.toContain('passwordHash');
    expect(Object.keys(document.components.schemas.UserResponseDto.properties).sort()).toEqual([
      'createdAt',
      'email',
      'id',
    ]);
  });

  describe('producer registry (feature 002)', () => {
    const REGISTRY_PATHS = [
      '/api/producers',
      '/api/producers/{id}',
      '/api/producers/{producerId}/properties',
      '/api/properties/{id}',
      '/api/properties/{propertyId}/crops',
      '/api/harvests',
      '/api/harvests/{id}',
      '/api/harvests/{harvestId}/crops',
      '/api/crops/{id}',
    ];

    it('exposes every registry path', () => {
      REGISTRY_PATHS.forEach((path) => expect(Object.keys(document.paths)).toContain(path));
    });

    /**
     * Feature 004 made the harvest a shared record, so a harvest nested under a property is not
     * merely unused - it is the old model. If this path comes back, the reshape was undone
     * somewhere, and Swagger would go on telling callers to create harvests per farm.
     */
    it('no longer nests harvests under a property', () => {
      expect(Object.keys(document.paths)).not.toContain('/api/properties/{propertyId}/harvests');
      expect(document.paths['/api/harvests/{harvestId}/crops'].post).toBeUndefined();
    });

    it('creates a crop from the property, naming the harvest in the body', () => {
      const body =
        document.paths['/api/properties/{propertyId}/crops'].post.requestBody.content[
          'application/json'
        ].schema;
      expect(body.$ref).toBe('#/components/schemas/CreateCropDto');
      expect(Object.keys(document.components.schemas.CreateCropDto.properties).sort()).toEqual([
        'harvestId',
        'name',
      ]);
    });

    /** FR-001: a harvest belongs to nobody, so no harvest shape may carry a property. */
    it('exposes no property field on a harvest', () => {
      expect(Object.keys(document.components.schemas.HarvestResponseDto.properties).sort()).toEqual(
        ['createdAt', 'id', 'updatedAt', 'year'],
      );
    });

    /** FR-002: the crop is the junction, so it must name both parents. */
    it('exposes both parents on a crop', () => {
      const crop = document.components.schemas.CropResponseDto.properties;
      expect(crop.propertyId).toBeDefined();
      expect(crop.harvestId).toBeDefined();
    });

    /**
     * R-008. Producers and properties no longer report a harvest count, because harvests are not
     * beneath them - so the example a caller reads must not show one either.
     */
    it('reports no harvest count when deleting a producer or a property', () => {
      const example = document.components.schemas.DeletionReportDto.properties.deleted.example;
      expect(example).toEqual({ producers: 1, properties: 3, crops: 89 });
      expect(Object.keys(example)).not.toContain('harvests');
    });

    it('documents the deletion counts as a named schema rather than a free-form object', () => {
      const counts = document.components.schemas.DeletionCountsDto;
      expect(Object.keys(counts.properties).sort()).toEqual([
        'crops',
        'harvests',
        'producers',
        'properties',
      ]);
      // Every count is optional: a report only carries what the operation actually considered.
      expect(counts.required ?? []).toEqual([]);
    });

    /**
     * The detail responses are where the new shape is visible to a reader. Left untyped, Swagger
     * shows an empty 200 and the grouping is invisible in the UI - which is exactly how the old
     * model went on being believed after the code changed.
     */
    it('types the detail responses, so the grouping is visible in the UI', () => {
      const ref = (path: string) =>
        document.paths[path].get.responses['200'].content['application/json'].schema.$ref;

      expect(ref('/api/producers/{id}')).toBe('#/components/schemas/ProducerDetailDto');
      expect(ref('/api/properties/{id}')).toBe('#/components/schemas/PropertyDetailDto');

      const grouped =
        document.paths['/api/properties/{propertyId}/crops'].get.responses['200'].content[
          'application/json'
        ].schema;
      expect(grouped.items.$ref).toBe('#/components/schemas/HarvestWithCropsDto');

      const group = document.components.schemas.HarvestWithCropsDto.properties;
      expect(Object.keys(group).sort()).toEqual(['crops', 'harvestId', 'year']);
    });

    /**
     * The areas are declared as Prisma.Decimal, and without an explicit `type: Number` Swagger
     * reflects that class and documents them as an empty object - so "Try it out" sends
     * {"totalArea": {}} and every request fails validation with no hint why.
     */
    it('documents the area inputs as numbers, not as the Decimal class', () => {
      for (const schema of ['CreatePropertyDto', 'UpdatePropertyDto']) {
        const props = document.components.schemas[schema].properties;
        ['totalArea', 'arableArea', 'vegetationArea'].forEach((field) => {
          expect({ schema, field, type: props[field].type }).toEqual({
            schema,
            field,
            type: 'number',
          });
        });
      }
    });

    /**
     * Every registry operation must require a bearer token. A `security: []` appearing here would
     * mean someone wrote @Public() on a registry route, silently opening the whole registry.
     */
    it('leaves no registry operation public', () => {
      REGISTRY_PATHS.forEach((path) => {
        Object.entries(document.paths[path]).forEach(([method, op]) => {
          if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) return;
          const operation = op as { security?: unknown[] };
          expect({ path, method, security: operation.security }).not.toEqual(
            expect.objectContaining({ security: [] }),
          );
        });
      });
    });

    it('documents the failure cases callers must handle', () => {
      const responses = (path: string, method: string) =>
        Object.keys(document.paths[path][method].responses);

      expect(responses('/api/producers', 'post')).toEqual(
        expect.arrayContaining(['201', '400', '401', '409']),
      );
      expect(responses('/api/producers/{id}', 'delete')).toEqual(
        expect.arrayContaining(['200', '401', '404']),
      );
      expect(responses('/api/properties/{propertyId}/crops', 'post')).toEqual(
        expect.arrayContaining(['201', '400', '401', '404', '409']),
      );
      expect(responses('/api/harvests', 'post')).toEqual(
        expect.arrayContaining(['201', '400', '401', '409']),
      );
      // FR-010: the refusal is part of the contract, not an incidental error.
      expect(responses('/api/harvests/{id}', 'delete')).toEqual(
        expect.arrayContaining(['200', '401', '404', '409']),
      );
    });

    // The internal comparison keys must never appear in a response schema.
    it('never exposes nameSearch or nameNormalized', () => {
      const serialised = JSON.stringify(document.components.schemas);
      expect(serialised).not.toContain('nameSearch');
      expect(serialised).not.toContain('nameNormalized');
    });

    it('returns areas as strings, so a client cannot reintroduce float drift', () => {
      const areas = document.components.schemas.PropertyResponseDto.properties;
      ['totalArea', 'arableArea', 'vegetationArea'].forEach((field) => {
        expect(areas[field].type).toBe('string');
      });
    });
  });

  describe('dashboard (feature 003)', () => {
    it('exposes the dashboard operation, protected like every other route', () => {
      expect(Object.keys(document.paths)).toContain('/api/dashboard');
      const op = document.paths['/api/dashboard'].get;
      expect(op.security).toBeDefined();
      expect(op.security).not.toEqual([]);
    });

    it('documents the responses a caller must handle', () => {
      const responses = Object.keys(document.paths['/api/dashboard'].get.responses);
      expect(responses).toEqual(expect.arrayContaining(['200', '401', '500']));
    });

    /**
     * FR-023 as a documentation gate, in its shortened form.
     *
     * The long ATENÇÃO paragraph spelling out that the crop chart does not reconcile with the
     * farm count was removed on request - it was more prose than the endpoint needed. What must
     * survive is the unit of each breakdown, which is what the paragraph existed to convey: a
     * reader who sees byState in HECTARES and byCrop in QUANTIDADE DE REGISTROS has what they
     * need to know the two are not comparable.
     */
    it('states the unit of each breakdown in the description', () => {
      const description = document.paths['/api/dashboard'].get.description as string;
      expect(description).toMatch(/QUANTIDADE DE REGISTROS/i);
      expect(description).toMatch(/HECTARES por unidade federativa/i);
    });

    it('declares the unit on every breakdown (FR-021)', () => {
      const breakdown = document.components.schemas.BreakdownDto;
      expect(breakdown.properties.unit.enum).toEqual(['hectares', 'count']);
    });

    it('returns hectare totals as a string, so a client cannot reintroduce float drift', () => {
      expect(document.components.schemas.TotalsDto.properties.hectares.type).toBe('string');
    });

    it('exposes no producer field in the dashboard schemas (FR-027)', () => {
      const serialised = JSON.stringify([
        document.components.schemas.DashboardSummaryDto,
        document.components.schemas.TotalsDto,
        document.components.schemas.BreakdownDto,
        document.components.schemas.CategoryDto,
      ]);
      expect(serialised).not.toContain('document');
      expect(serialised).not.toContain('cpf');
      expect(serialised).not.toContain('nameSearch');
    });
  });

  it('writes stakeholder-facing descriptions in pt-BR (Constitution VIII)', () => {
    expect(document.paths['/api/auth/login'].post.summary).toMatch(
      /Autentica um usuário e devolve o token/,
    );
    expect(document.paths['/api/auth/register'].post.summary).toMatch(/Cadastra um novo usuário/);
  });

  /**
   * pt-BR means accented pt-BR. The harvest and crop text was written through a shell that ate the
   * diacritics, and unaccented Portuguese reads as broken to the stakeholders this text is for.
   * Checking the words that MUST carry an accent catches the whole class at once.
   */
  it('accents the pt-BR text on the harvest and crop routes', () => {
    const text = [
      document.paths['/api/harvests'].get,
      document.paths['/api/harvests'].post,
      document.paths['/api/harvests/{id}'].patch,
      document.paths['/api/harvests/{id}'].delete,
      document.paths['/api/properties/{propertyId}/crops'].post,
      document.paths['/api/harvests/{harvestId}/crops'].get,
    ]
      .map((op) => `${op.summary} ${op.description ?? ''}`)
      .join(' ');

    ['disponiveis', 'unica', 'valido', 'nao ', 'ninguem', 'correcao', 'comparacao', 'so vez'].forEach(
      (unaccented) => expect(text).not.toContain(unaccented),
    );
    expect(text).toContain('não');
    expect(text).toContain('safra é compartilhada');
  });

  it('explains, on the delete routes, that a shared harvest survives', () => {
    expect(document.paths['/api/producers/{id}'].delete.description).toMatch(/SAFRAS PERMANECEM/);
    expect(document.paths['/api/properties/{id}'].delete.description).toMatch(
      /SAFRAS TAMBÉM PERMANECEM/,
    );
  });
});
