import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateHarvestDto,
  MIN_HARVEST_YEAR,
  maxHarvestYear,
} from '../../../src/harvests/dto/create-harvest.dto';

const check = (year: unknown) => validateSync(plainToInstance(CreateHarvestDto, { year }));

describe('Harvest year bounds (FR-022)', () => {
  afterEach(() => jest.useRealTimers());

  it('rejects a year before 1900', () => {
    expect(check(1899).length).toBeGreaterThan(0);
  });

  it('accepts the lower bound', () => {
    expect(check(MIN_HARVEST_YEAR)).toHaveLength(0);
  });

  it('accepts the current year plus one', () => {
    expect(check(maxHarvestYear())).toHaveLength(0);
  });

  it('rejects two years ahead', () => {
    expect(check(maxHarvestYear() + 1).length).toBeGreaterThan(0);
  });

  it.each([[1.5], ['2021abc'], [null], [undefined]])('rejects %p as a year', (value) => {
    expect(check(value).length).toBeGreaterThan(0);
  });

  /**
   * The bound moves with the calendar. A hardcoded upper limit is correct until 31 December and
   * wrong from 1 January, which is the kind of bug that surfaces at the worst moment.
   */
  describe('across a year boundary', () => {
    it('accepts 2031 when the clock says 2030, and rejects it when the clock says 2029', () => {
      // Local-time constructors on purpose: getFullYear() reads local time, so a UTC instant
      // near midnight on 31 December lands in the previous year in any negative offset - which
      // is exactly the ambiguity this test exists to pin down.
      jest.useFakeTimers().setSystemTime(new Date(2030, 5, 15, 12, 0, 0));
      expect(maxHarvestYear()).toBe(2031);
      expect(check(2031)).toHaveLength(0);

      jest.setSystemTime(new Date(2029, 11, 31, 23, 59, 0));
      expect(maxHarvestYear()).toBe(2030);
      expect(check(2031).length).toBeGreaterThan(0);

      // Two minutes later it is accepted, purely because the local year rolled over.
      jest.setSystemTime(new Date(2030, 0, 1, 0, 1, 0));
      expect(maxHarvestYear()).toBe(2031);
      expect(check(2031)).toHaveLength(0);
    });
  });
});
