import styled from 'styled-components';
import { Button } from '../../components/Button';
import { PlantingList } from './PlantingList';
import { PencilIcon, PlusIcon, TrashIcon } from '../../icons';
import { formatArea, unclassifiedArea } from '../../lib/area';
import type { PropertyDetail } from '../producers/types';

const Card = styled.article`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.space.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

const Head = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
  flex-wrap: wrap;
`;

const Name = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  overflow-wrap: anywhere;
`;

const Place = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Areas = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: ${({ theme }) => theme.space.sm};
  margin: 0;
  padding: ${({ theme }) => theme.space.sm} 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const AreaLabel = styled.dt`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const AreaValue = styled.dd`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-variant-numeric: tabular-nums;
`;

const PlantingsHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
`;

const PlantingsTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

function Area({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <AreaLabel>{label}</AreaLabel>
      <AreaValue>{formatArea(value)} ha</AreaValue>
    </div>
  );
}

export function FarmCard({
  farm,
  onEdit,
  onDelete,
  onAddCrop,
  onDeleteCrop,
}: {
  farm: PropertyDetail;
  onEdit: () => void;
  onDelete: () => void;
  onAddCrop: () => void;
  onDeleteCrop: (cropId: string, cropName: string) => void;
}) {
  // Shown only when some area is genuinely unaccounted for, mirroring the dashboard's rule.
  const unclassified = unclassifiedArea(farm.totalArea, farm.arableArea, farm.vegetationArea);

  return (
    <Card>
      <Head>
        <div>
          <Name>{farm.farmName}</Name>
          <Place>
            {farm.city} — {farm.state}
          </Place>
        </div>
        <Actions>
          <Button variant="ghost" onClick={onEdit} aria-label={`Editar ${farm.farmName}`}>
            <PencilIcon size={16} />
            Editar
          </Button>
          <Button variant="ghost" onClick={onDelete} aria-label={`Excluir ${farm.farmName}`}>
            <TrashIcon size={16} />
            Excluir
          </Button>
        </Actions>
      </Head>

      <Areas>
        <Area label="Área total" value={farm.totalArea} />
        <Area label="Agricultável" value={farm.arableArea} />
        <Area label="Vegetação" value={farm.vegetationArea} />
        {unclassified > 0 && <Area label="Não classificada" value={unclassified} />}
      </Areas>

      <PlantingsHead>
        <PlantingsTitle>Plantios por safra</PlantingsTitle>
        <Button variant="secondary" onClick={onAddCrop}>
          <PlusIcon size={16} />
          Nova cultura
        </Button>
      </PlantingsHead>

      <PlantingList harvests={farm.harvests} onDelete={onDeleteCrop} />
    </Card>
  );
}
