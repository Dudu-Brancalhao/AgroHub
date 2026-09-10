import styled from 'styled-components';
import { TrashIcon } from '../../icons';
import { transitioned } from '../../styles/motion';
import type { HarvestWithCrops } from '../producers/types';

const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
`;

const Group = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space.sm};
  flex-wrap: wrap;
`;

const Year = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  font-variant-numeric: tabular-nums;
  min-width: 4ch;
`;

const Crops = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xxs};
  padding: ${({ theme }) => `${theme.space.xxs} ${theme.space.xs}`};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const Remove = styled.button`
  background: none;
  border: none;
  padding: 0;
  line-height: 0;
  color: inherit;
  border-radius: ${({ theme }) => theme.radii.sm};

  ${transitioned('color', '120ms')}

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

const Empty = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/**
 * FR-035: a farm's crops grouped by season.
 *
 * The grouping arrives already done, nested in the producer detail response — nothing here
 * re-groups or re-sorts server data beyond putting the most recent season first.
 */
export function PlantingList({
  harvests,
  onDelete,
}: {
  harvests: HarvestWithCrops[];
  onDelete: (cropId: string, cropName: string) => void;
}) {
  if (harvests.length === 0) {
    return <Empty>Nenhuma cultura registrada nesta fazenda.</Empty>;
  }

  const ordered = [...harvests].sort((a, b) => b.year - a.year);

  return (
    <Groups>
      {ordered.map((harvest) => (
        <Group key={harvest.harvestId}>
          <Year>{harvest.year}</Year>
          <Crops>
            {harvest.crops.map((crop) => (
              <Chip key={crop.id}>
                {crop.name}
                <Remove
                  type="button"
                  aria-label={`Remover ${crop.name} da safra ${harvest.year}`}
                  onClick={() => onDelete(crop.id, crop.name)}
                >
                  <TrashIcon size={13} />
                </Remove>
              </Chip>
            ))}
          </Crops>
        </Group>
      ))}
    </Groups>
  );
}
