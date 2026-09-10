import { useEffect } from 'react';
import styled from 'styled-components';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchHarvestCrops, fetchHarvests } from './harvestsSlice';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { NotFound } from '../../components/NotFound';
import { FarmIcon } from '../../icons';
import { pluralize } from '../../lib/format';

const BackLink = styled(Link)`
  display: inline-block;
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.space.sm};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-variant-numeric: tabular-nums;
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const Group = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.space.md};
`;

const FarmName = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs};
  font-size: ${({ theme }) => theme.font.size.md};
  margin-bottom: ${({ theme }) => theme.space.xs};
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

const Crops = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Chip = styled.li`
  padding: ${({ theme }) => `${theme.space.xxs} ${theme.space.xs}`};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

/**
 * FR-042: what was planted in this season, across every farm.
 *
 * Each crop carries `propertyId` but not the farm's name, so the thunk resolves the names
 * alongside the crops (contracts/api-client.md operations 17 and 11). A farm whose name could
 * not be read falls back to its identifier rather than blanking the row.
 */
export function SafraDetail() {
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const { items, detail, request } = useAppSelector((state) => state.harvests);

  useEffect(() => {
    if (request.status === 'idle') void dispatch(fetchHarvests());
  }, [dispatch, request.status]);

  useEffect(() => {
    if (id && detail.id !== id) void dispatch(fetchHarvestCrops(id));
  }, [dispatch, id, detail.id]);

  const harvest = items.find((item) => item.id === id);

  if (detail.request.status === 'failed') {
    return (
      <NotFound
        title="Safra não encontrada"
        description="Esta safra não existe ou foi removida."
        backTo="/safras"
        backLabel="Voltar para Safras"
      />
    );
  }

  const isLoading = detail.id !== id || detail.request.status === 'pending';

  const byFarm = new Map<string, string[]>();
  for (const crop of detail.crops) {
    byFarm.set(crop.propertyId, [...(byFarm.get(crop.propertyId) ?? []), crop.name]);
  }

  return (
    <>
      <BackLink to="/safras">← Voltar para Safras</BackLink>

      <Title>Safra {harvest?.year ?? ''}</Title>
      <Subtitle>
        {isLoading
          ? 'Carregando os plantios desta safra…'
          : `${pluralize(detail.crops.length, 'cultura registrada', 'culturas registradas')} em ${pluralize(byFarm.size, 'fazenda', 'fazendas')}.`}
      </Subtitle>

      {/* A failed load already returned the not-found screen above, so only three states remain. */}
      {isLoading ? (
        <SkeletonList rows={3} height="5rem" />
      ) : detail.crops.length === 0 ? (
        <EmptyState
          title="Nenhuma cultura registrada nesta safra"
          description="Registre culturas a partir da fazenda, na tela do produtor."
          action={<Link to="/produtores">Ir para Produtores</Link>}
        />
      ) : (
        <Groups>
          {[...byFarm.entries()].map(([propertyId, crops]) => (
            <Group key={propertyId}>
              <FarmName>
                <FarmIcon size={18} />
                {detail.farmNames[propertyId] ?? `Fazenda ${propertyId.slice(0, 8)}`}
              </FarmName>
              <Crops>
                {crops.map((crop) => (
                  <Chip key={`${propertyId}-${crop}`}>{crop}</Chip>
                ))}
              </Crops>
            </Group>
          ))}
        </Groups>
      )}
    </>
  );
}
