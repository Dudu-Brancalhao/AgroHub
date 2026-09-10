import styled from 'styled-components';
import { Skeleton } from '../../components/Skeleton';

const Totals = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.space.md};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Breakdowns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.space.md};
`;

const Card = styled.div`
  padding: ${({ theme }) => theme.space.lg};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

/**
 * FR-048 and SC-005: the placeholders occupy the *final* position of every figure, using the
 * same grid as the real Dashboard, so nothing shifts when the data lands. A skeleton with a
 * different layout would technically fill the wait and still fail the requirement.
 */
export function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-skeleton" aria-busy="true" aria-label="Carregando o painel">
      <Skeleton $width="200px" $height="2rem" />
      <div style={{ height: '2rem' }} />

      <Totals>
        <Card>
          <Skeleton $width="140px" $height="0.875rem" />
          <Skeleton $width="90px" $height="2rem" />
        </Card>
        <Card>
          <Skeleton $width="140px" $height="0.875rem" />
          <Skeleton $width="120px" $height="2rem" />
        </Card>
      </Totals>

      <Breakdowns>
        {[0, 1, 2].map((card) => (
          <Card key={card}>
            <Skeleton $width="160px" $height="1rem" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} $height="1.75rem" />
            ))}
          </Card>
        ))}
      </Breakdowns>
    </div>
  );
}
