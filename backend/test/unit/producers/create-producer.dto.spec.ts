import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProducerDto } from '../../../src/producers/dto/create-producer.dto';
import { REPEATED_DIGIT, VALID_CPFS } from '../../support/document-fixtures';

function check(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProducerDto, payload);
  return { dto, fields: validateSync(dto).map((e) => e.property) };
}

describe('CreateProducerDto', () => {
  it('accepts a valid document and name', () => {
    expect(check({ document: VALID_CPFS[0], name: 'José Antônio' }).fields).toHaveLength(0);
  });

  it('normalises the document to digits before validating (FR-007)', () => {
    const { dto, fields } = check({ document: '529.982.247-25', name: 'Teste' });
    expect(fields).toHaveLength(0);
    expect(dto.document).toBe('52998224725');
  });

  it('trims and collapses the name but keeps its capitalisation (FR-009)', () => {
    expect(check({ document: VALID_CPFS[0], name: '  José   Antônio ' }).dto.name).toBe(
      'José Antônio',
    );
  });

  it.each(REPEATED_DIGIT)('rejects repeated-digit document %s', (document) => {
    expect(check({ document, name: 'Teste' }).fields).toContain('document');
  });

  it('rejects an empty name once trimmed', () => {
    expect(check({ document: VALID_CPFS[0], name: '   ' }).fields).toContain('name');
  });

  it('rejects a name over 200 characters', () => {
    expect(check({ document: VALID_CPFS[0], name: 'a'.repeat(201) }).fields).toContain('name');
  });

  it('reports both failing fields at once (FR-035)', () => {
    expect(check({ document: '123', name: '' }).fields.sort()).toEqual(['document', 'name']);
  });
});
