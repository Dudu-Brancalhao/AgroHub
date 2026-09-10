import { animated, fadeIn, prefersReducedMotion, transitioned } from './motion';

/**
 * FR-054 and SC-010: no motion when the visitor's system asks for reduced motion, and no loss of
 * information either — the content still renders, it just arrives instantly.
 *
 * The guarantee is structural rather than conditional: every animation is emitted *inside* a
 * `prefers-reduced-motion: no-preference` block, so the browser never applies it under `reduce`.
 * Asserting the wrapper is what makes the guarantee testable in jsdom, which has no real media
 * query engine.
 */

function flatten(rules: unknown): string {
  if (typeof rules === 'string') return rules;
  if (Array.isArray(rules)) return rules.map(flatten).join('');
  if (rules && typeof rules === 'object' && 'getName' in rules) {
    return String((rules as { getName: () => string }).getName());
  }
  return String(rules ?? '');
}

describe('animated', () => {
  it('emits the animation only inside a no-preference media query', () => {
    const css = flatten(animated(fadeIn, '180ms', 'ease-out'));

    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('animation:');

    // The animation must not also appear outside the guard, which would leak past `reduce`.
    const [beforeMedia] = css.split('@media');
    expect(beforeMedia).not.toContain('animation:');
  });

  it('carries the duration and easing it was given', () => {
    const css = flatten(animated(fadeIn, '120ms', 'linear', 'infinite'));

    expect(css).toContain('120ms');
    expect(css).toContain('linear');
    expect(css).toContain('infinite');
  });
});

describe('transitioned', () => {
  it('emits the transition only inside a no-preference media query', () => {
    const css = flatten(transitioned('background-color', '120ms'));

    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('transition:');

    const [beforeMedia] = css.split('@media');
    expect(beforeMedia).not.toContain('transition:');
  });
});

describe('prefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('reports the system preference', () => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query })) as never;
    expect(prefersReducedMotion()).toBe(true);

    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as never;
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reports no preference where matchMedia does not exist, rather than throwing', () => {
    (window as { matchMedia?: unknown }).matchMedia = undefined;

    expect(prefersReducedMotion()).toBe(false);
  });
});
