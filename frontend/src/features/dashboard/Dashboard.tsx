import { useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchSummary } from './dashboardSlice';
import { selectBreakdown, selectSummary, selectSummaryIsStale, selectSummaryRequest } from './selectors';
import { PieChart } from '../../components/PieChart';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { formatArea } from '../../lib/area';
import { formatCount } from '../../lib/format';
import { theme as appTheme } from '../../styles/theme';
import type { BreakdownKind, BreakdownUnit } from './types';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
  margin-bottom: ${({ theme }) => theme.space.xs};
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Totals = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.space.md};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Card = styled.section`
  padding: ${({ theme }) => theme.space.lg};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
  /* Todos os cartões da linha acompanham o mais alto (item 7). */
  height: 100%;
`;

const TotalLabel = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TotalValue = styled.p`
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  font-variant-numeric: tabular-nums;
`;

const Breakdowns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.space.md};
  /*
   * Nada de align-items aqui: o padrão do grid e stretch, e e ele que faz os tres cartoes
   * acompanharem o mais alto da linha. O height 100% no cartao completa o efeito.
   */
`;

const CardTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.md};
`;

const CardUnit = styled.p`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.space.sm};
`;

/**
 * The title names the dimension; the unit is read from the response rather than assumed.
 *
 * The live API returns hectares by state and a planting count by crop — the opposite of what a
 * name like "Fazendas por estado" would promise. Labelling from `unit` means the heading can
 * never contradict the numbers under it.
 */
const UNIT_LABEL: Record<BreakdownUnit, string> = {
  hectares: 'em hectares',
  count: 'em número de registros',
};

function formatValue(unit: BreakdownUnit, value: number): string {
  return unit === 'hectares' ? `${formatArea(value)} ha` : formatCount(value);
}

function BreakdownCard({ title, kind }: { title: string; kind: BreakdownKind }) {
  const breakdown = useAppSelector((state) => selectBreakdown(state, kind));

  if (!breakdown) return null;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardUnit>{UNIT_LABEL[breakdown.unit]}</CardUnit>
      <PieChart
        totalLabel={breakdown.unit === 'hectares' ? 'hectares' : 'registros'}
        total={formatValue(breakdown.unit, breakdown.total)}
        slices={breakdown.slices.map((slice, index) => ({
          key: slice.key,
          label: slice.label,
          value: formatValue(breakdown.unit, slice.value),
          share: slice.share,
          // Fixed order, never cycled: a category keeps its colour however many others are on
          // screen. The folded remainder takes a neutral rather than a seventh hue.
          color: slice.isOther
            ? appTheme.chartOther
            : appTheme.chart[index % appTheme.chart.length]!,
        }))}
      />
    </Card>
  );
}

export function Dashboard() {
  const dispatch = useAppDispatch();
  const summary = useAppSelector(selectSummary);
  const request = useAppSelector(selectSummaryRequest);
  const stale = useAppSelector(selectSummaryIsStale);

  useEffect(() => {
    // Fetch when there is nothing yet, or when a mutation elsewhere invalidated it (FR-045).
    if (request.status === 'idle' || (stale && request.status !== 'pending')) {
      void dispatch(fetchSummary());
    }
  }, [dispatch, request.status, stale]);

  if (request.status === 'failed' && !summary) {
    return (
      <ErrorState
        message={request.error ?? 'Não foi possível carregar o painel.'}
        onRetry={() => void dispatch(fetchSummary())}
      />
    );
  }

  if (!summary) return <DashboardSkeleton />;

  if (summary.totals.farms === 0) {
    return (
      <>
        <Title>Dashboard</Title>
        <Subtitle>Visão geral do cadastro.</Subtitle>
        <EmptyState
          title="Nenhuma fazenda cadastrada"
          description="Cadastre um produtor e suas fazendas para ver os números aqui."
          action={<Link to="/produtores/novo">Cadastrar produtor</Link>}
        />
      </>
    );
  }

  return (
    <>
      <Title>Dashboard</Title>
      <Subtitle>Visão geral do cadastro.</Subtitle>

      <Totals>
        <Card>
          <TotalLabel>Fazendas cadastradas</TotalLabel>
          <TotalValue>{formatCount(summary.totals.farms)}</TotalValue>
        </Card>
        <Card>
          <TotalLabel>Hectares cadastrados</TotalLabel>
          <TotalValue>{formatArea(summary.totals.hectares)} ha</TotalValue>
        </Card>
      </Totals>

      <Breakdowns>
        <BreakdownCard title="Por estado" kind="byState" />
        <BreakdownCard title="Por cultura" kind="byCrop" />
        <BreakdownCard title="Por uso do solo" kind="byLandUse" />
      </Breakdowns>
    </>
  );
}
