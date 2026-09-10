import {
  formatArea,
  isWithinTotal,
  parseArea,
  parseAreaInput,
  subtractAreas,
  sumAreas,
  toApiNumber,
} from './area';

describe('parseArea', () => {
  it('turns a decimal string into an integer of centiares', () => {
    expect(parseArea('1500.11')).toBe(150011);
    expect(parseArea('1000')).toBe(100000);
    expect(parseArea('0.01')).toBe(1);
    expect(parseArea('0')).toBe(0);
  });

  it('pads a single decimal place', () => {
    expect(parseArea('1500.1')).toBe(150010);
  });

  it('rejects anything that is not a plain decimal', () => {
    expect(parseArea('')).toBeNull();
    expect(parseArea('abc')).toBeNull();
    expect(parseArea('1.234')).toBeNull();
    expect(parseArea('-1')).toBeNull();
  });
});

describe('parseAreaInput', () => {
  it('accepts the comma the pt-BR keyboard produces', () => {
    expect(parseAreaInput('1500,11')).toBe(150011);
    expect(parseAreaInput('1.500,11')).toBe(150011);
  });

  it('accepts a plain dot decimal too', () => {
    expect(parseAreaInput('1500.11')).toBe(150011);
  });

  it('rejects more than two decimal places', () => {
    expect(parseAreaInput('1500,111')).toBeNull();
  });
});

describe('formatArea', () => {
  it('renders centiares as a pt-BR decimal with exactly two places', () => {
    expect(formatArea(150011)).toBe('1.500,11');
    expect(formatArea(100000)).toBe('1.000,00');
    expect(formatArea(1)).toBe('0,01');
    expect(formatArea(0)).toBe('0,00');
  });
});

describe('toApiNumber', () => {
  it('emits a JSON number that round-trips exactly', () => {
    expect(toApiNumber(150011)).toBe(1500.11);
    expect(JSON.parse(JSON.stringify({ a: toApiNumber(150011) })).a).toBe(1500.11);
  });
});

describe('sumAreas and subtractAreas', () => {
  it('adds without drift', () => {
    expect(sumAreas(100000, 50011)).toBe(150011);
  });

  it('subtracts without drift', () => {
    expect(subtractAreas(150011, 100000, 50011)).toBe(0);
  });
});

describe('isWithinTotal', () => {
  /**
   * The regression this whole module exists for.
   *
   * In floats, 1000 + 500.11 === 1500.1100000000001, which is greater than 1500.11 — so a naive
   * check refuses a farm the server accepts. The backend's own schema comment records this exact
   * case (research.md R-004).
   */
  it('accepts a farm whose parts sum exactly to the total', () => {
    const total = parseArea('1500.11')!;
    const arable = parseArea('1000')!;
    const vegetation = parseArea('500.11')!;

    expect(isWithinTotal(total, arable, vegetation)).toBe(true);
  });

  it('proves the float version of the same comparison would have failed', () => {
    expect(1000 + 500.11 <= 1500.11).toBe(false);
  });

  it('refuses a farm whose parts exceed the total', () => {
    expect(isWithinTotal(parseArea('100')!, parseArea('60')!, parseArea('50')!)).toBe(false);
  });

  it('accepts parts that leave an unclassified remainder', () => {
    expect(isWithinTotal(parseArea('100')!, parseArea('60')!, parseArea('20')!)).toBe(true);
  });

  it('accepts a farm with no arable or vegetation area at all', () => {
    expect(isWithinTotal(parseArea('100')!, 0, 0)).toBe(true);
  });
});
