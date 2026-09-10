import styled from 'styled-components';
import { animated, shimmer } from '../styles/motion';

/**
 * FR-048: a region awaiting server data shows placeholder content shaped like what will replace
 * it, so the layout does not shift when the data arrives (SC-005).
 *
 * The shimmer is decorative and stops under reduced motion; the block itself stays, because the
 * shape is the information.
 */
export const Skeleton = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${({ $width = '100%' }) => $width};
  height: ${({ $height = '1rem' }) => $height};
  border-radius: ${({ theme, $radius }) => $radius ?? theme.radii.sm};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.surfaceSunken} 25%,
    ${({ theme }) => theme.colors.border} 37%,
    ${({ theme }) => theme.colors.surfaceSunken} 63%
  );
  background-size: 400% 100%;

  ${animated(shimmer, '1400ms', 'ease-in-out', 'infinite')}
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

/** Several skeleton lines, for a list whose row count is not yet known. */
export function SkeletonList({ rows = 4, height = '3rem' }: { rows?: number; height?: string }) {
  return (
    <Stack aria-hidden="true" data-testid="skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} $height={height} />
      ))}
    </Stack>
  );
}
