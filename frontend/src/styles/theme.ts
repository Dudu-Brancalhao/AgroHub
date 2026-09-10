/**
 * Every colour, space and duration the interface uses. Components reference tokens, never
 * literals, so a change here reaches the whole application.
 *
 * Durations are all at or below 200ms: FR-052 requires that no transition ever be long enough
 * to be felt as waiting.
 */
export const theme = {
  colors: {
    surface: '#ffffff',
    surfaceMuted: '#f6f8f5',
    surfaceSunken: '#eef2ec',
    border: '#d7ded3',
    borderStrong: '#b8c4b2',

    text: '#1e2a21',
    textMuted: '#5c6b5f',
    textInverted: '#ffffff',

    primary: '#2f7d4f',
    primaryHover: '#276742',
    primarySoft: '#e4f0e8',

    danger: '#b3261e',
    dangerHover: '#8f1e18',
    dangerSoft: '#fbe9e7',

    success: '#2f7d4f',
    successSoft: '#e4f0e8',

    warning: '#8a6116',
    warningSoft: '#fbf1dc',

    focusRing: '#1b64c4',
  },

  /**
   * Categorical fills for the dashboard breakdowns.
   *
   * Assigned in fixed order and never cycled — a category keeps its colour regardless of how
   * many others are on screen. The order itself is the colourblind-safety mechanism, not a
   * cosmetic choice: validated at worst adjacent ΔE 9.1 (protan) and 19.6 (normal vision) on a
   * white surface, which clears both gates.
   *
   * Three of these sit below 3:1 contrast against white, so identity is never carried by colour
   * alone: every slice is labelled with its share and repeated in a legend as real text.
   */
  chart: [
    '#2a78d6', // blue
    '#eb6834', // orange
    '#1baf7a', // aqua
    '#eda100', // yellow
    '#e87ba4', // magenta
    '#008300', // green
  ],
  /** Anything past the sixth slice folds into this, rather than inventing a seventh hue. */
  chartOther: '#8a8a80',

  space: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },

  radii: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    pill: '999px',
  },

  font: {
    family:
      "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.25rem',
      xl: '1.5rem',
      xxl: '2rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },

  /** FR-052: nothing above 200ms. */
  duration: {
    fast: '120ms',
    base: '180ms',
    slow: '200ms',
  },

  easing: 'cubic-bezier(0.2, 0, 0.2, 1)',

  shadow: {
    sm: '0 1px 2px rgba(30, 42, 33, 0.08)',
    md: '0 4px 12px rgba(30, 42, 33, 0.12)',
    lg: '0 12px 32px rgba(30, 42, 33, 0.18)',
  },

  layout: {
    headerHeight: '56px',
    sidebarWidth: '232px',
    contentMaxWidth: '1120px',
  },

  breakpoint: {
    /** Below this the sidebar collapses behind the header toggle (FR-007). */
    tablet: '768px',
  },

  zIndex: {
    header: 100,
    sidebar: 90,
    overlay: 200,
    modal: 210,
    toast: 300,
  },
} as const;

export type AppTheme = typeof theme;
