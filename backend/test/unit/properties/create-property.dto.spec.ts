import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '@prisma/client';
import { CreatePropertyDto } from '../../../src/properties/dto/create-property.dto';

const base = {
  farmName: 'Fazenda Santa Helena',
  city: 'Uberaba',
  state: 'MG',
  totalArea: 100,
  arableArea: 60,
  vegetationArea: 30,
};

function check(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreatePropertyDto, payload);
  return { dto, fields: validateSync(dto).map((e) => e.property) };
}

describe('CreatePropertyDto', () => {
  it('accepts a consistent property', () => {
    expect(check(base).fields).toHaveLength(0);
  });

  it('carries areas forward as Decimal, never as number (FR-016)', () => {
    const { dto } = check({ ...base, totalArea: 1500.11, arableArea: 1000, vegetationArea: 500.11 });
    expect(dto.totalArea).toBeInstanceOf(Prisma.Decimal);
    expect(dto.totalArea.toFixed(2)).toBe('1500.11');
    expect(dto.vegetationArea.toFixed(2)).toBe('500.11');
  });

  it.each(['XX', 'mg1', '', 'SPX'])('rejects invalid state %p (FR-017)', (state) => {
    expect(check({ ...base, state }).fields).toContain('state');
  });

  it('uppercases a lowercase state rather than rejecting it', () => {
    const { dto, fields } = check({ ...base, state: 'mg' });
    expect(fields).toHaveLength(0);
    expect(dto.state).toBe('MG');
  });

  it('rejects negative areas (FR-015)', () => {
    expect(check({ ...base, arableArea: -5 }).fields).toContain('arableArea');
    expect(check({ ...base, vegetationArea: -0.01 }).fields).toContain('vegetationArea');
  });

  it('rejects a total area of zero but accepts zero parts (FR-015)', () => {
    expect(check({ ...base, totalArea: 0 }).fields).toContain('totalArea');
    expect(check({ ...base, arableArea: 0, vegetationArea: 0 }).fields).toHaveLength(0);
  });

  it('rejects more than two decimal places', () => {
    expect(check({ ...base, totalArea: 100.123 }).fields).toContain('totalArea');
  });

  it('reports every failing field at once (FR-035)', () => {
    const fields = check({ ...base, state: 'XX', arableArea: -5 }).fields.sort();
    expect(fields).toEqual(['arableArea', 'state']);
  });
});
