import '@testing-library/jest-dom';

/**
 * jsdom implements no media queries. Components ask for `prefers-reduced-motion`, so without
 * this every test that touches the theme throws. Defaults to "no preference"; a test that cares
 * overrides the return value.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
});
