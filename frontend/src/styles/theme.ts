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

    // Verde saturado ao máximo que ainda carrega texto branco: 4.77:1 contra o branco,
    // acima do mínimo de 4.5:1. O anterior tinha 45% de saturação; este tem 100%.
    primary: '#008531',
    primaryHover: '#006b27',
    primarySoft: '#eafbf0',

    danger: '#b3261e',
    dangerHover: '#8f1e18',
    dangerSoft: '#fbe9e7',

    success: '#008531',
    successSoft: '#eafbf0',

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
    family: "'Poppins', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
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
      // 600 e não 700: no Poppins o peso 700 fica pesado demais para títulos de interface.
      bold: 600,
    },
  },

  /** FR-052: nothing above 200ms. */
  duration: {
    fast: '120ms',
    base: '180ms',
    slow: '200ms',
  },

  easing: 'cubic-bezier(0.2, 0, 0.2, 1)',

  /**
   * Sombras em duas camadas: uma curta, que encosta o elemento na superfície, e uma longa e
   * difusa, que dá a profundidade. É o que separa uma sombra que parece moderna de uma que
   * parece um contorno borrado.
   *
   * O tom não é preto puro — é o verde escuro do texto, com opacidade baixa. Sombra preta sobre
   * fundo colorido acinzenta o que está embaixo.
   *
   * Estas sombras substituem as bordas: são elas que delimitam cada cartão agora.
   */
  shadow: {
    sm: '0 1px 2px rgba(18, 42, 28, 0.04), 0 1px 3px rgba(18, 42, 28, 0.06)',
    card: '0 1px 2px rgba(18, 42, 28, 0.04), 0 2px 8px rgba(18, 42, 28, 0.06)',
    cardHover: '0 2px 4px rgba(18, 42, 28, 0.05), 0 8px 20px rgba(18, 42, 28, 0.10)',
    md: '0 2px 4px rgba(18, 42, 28, 0.04), 0 4px 12px rgba(18, 42, 28, 0.08)',
    lg: '0 4px 8px rgba(18, 42, 28, 0.05), 0 12px 32px rgba(18, 42, 28, 0.12)',
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
