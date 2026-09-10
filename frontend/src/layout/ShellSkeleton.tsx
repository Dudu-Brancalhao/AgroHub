import styled from 'styled-components';
import { Skeleton } from '../components/Skeleton';

const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${({ theme }) => theme.layout.headerHeight};
  display: flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.space.md};
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Side = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.layout.headerHeight};
  bottom: 0;
  left: 0;
  width: ${({ theme }) => theme.layout.sidebarWidth};
  padding: ${({ theme }) => theme.space.md} ${({ theme }) => theme.space.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
  background: ${({ theme }) => theme.colors.surface};
  border-right: 1px solid ${({ theme }) => theme.colors.border};

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    display: none;
  }
`;

const Body = styled.div`
  margin-top: ${({ theme }) => theme.layout.headerHeight};
  margin-left: ${({ theme }) => theme.layout.sidebarWidth};
  padding: ${({ theme }) => theme.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    margin-left: 0;
  }
`;

/**
 * Shown while the stored session is being verified.
 *
 * The shell's own shape, rather than a spinner or a redirect: redirecting during bootstrap would
 * flash the sign-in screen at every reload for a signed-in user (contracts/routes.md).
 */
export function ShellSkeleton() {
  return (
    <div data-testid="shell-skeleton" aria-busy="true" aria-label="Carregando">
      <Bar>
        <Skeleton $width="120px" $height="1.5rem" />
      </Bar>
      <Side>
        <Skeleton $height="2.25rem" />
        <Skeleton $height="2.25rem" />
        <Skeleton $height="2.25rem" />
      </Side>
      <Body>
        <Skeleton $width="240px" $height="2rem" />
        <Skeleton $height="8rem" />
        <Skeleton $height="8rem" />
      </Body>
    </div>
  );
}
