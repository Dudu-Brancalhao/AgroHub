import styled from 'styled-components';
import type { ReactNode } from 'react';
import { animated, fadeInUp } from '../styles/motion';

const Wrapper = styled.div`
  ${animated(fadeInUp, '180ms', 'cubic-bezier(0.2, 0, 0.2, 1)')}
`;

/**
 * FR-052: incoming content settles into place on a destination change.
 *
 * Keyed on the path only, never on the search parameters: re-running the animation on every
 * keystroke of a search would read as flicker, not as polish (contracts/routes.md). The
 * animation itself is suppressed under reduced motion by `animated` (FR-054).
 */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return <Wrapper key={routeKey}>{children}</Wrapper>;
}
