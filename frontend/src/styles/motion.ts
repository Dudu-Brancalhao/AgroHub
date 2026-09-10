import { css, keyframes } from 'styled-components';
import type { Keyframes } from 'styled-components';

/**
 * Every animation in the application passes through here.
 *
 * FR-054 requires all motion to stop when the visitor's system asks for reduced motion — with no
 * loss of information. Wrapping the animation (rather than removing the element) is what
 * guarantees that: the content still renders, it just arrives instantly.
 */

export const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

export const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
`;

export const slideInLeft = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: none; }
`;

export const shimmer = keyframes`
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
`;

export const spin = keyframes`
  to { transform: rotate(360deg); }
`;

/**
 * Applies an animation only when the visitor has not asked for reduced motion.
 *
 * Deliberately opt-in per animation rather than a single global override: a global
 * `animation: none !important` would also kill the busy spinner, which carries information
 * about an in-flight request rather than decoration.
 */
export function animated(animation: Keyframes, duration: string, easing = 'ease', extra = '') {
  return css`
    @media (prefers-reduced-motion: no-preference) {
      animation: ${animation} ${duration} ${easing} ${extra};
    }
  `;
}

/** Same contract as `animated`, for transitions rather than keyframes. */
export function transitioned(properties: string, duration: string, easing = 'ease') {
  return css`
    @media (prefers-reduced-motion: no-preference) {
      transition: ${properties} ${duration} ${easing};
    }
  `;
}

/**
 * True when the visitor's system asks for reduced motion. Used by the few places that must
 * branch in JavaScript rather than in CSS — skipping a transition's cleanup timer, for example.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
