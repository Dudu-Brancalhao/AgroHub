import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  createCrop,
  createProperty,
  deleteCrop,
  deleteProducer,
  deleteProperty,
  fetchProducer,
  mutationErrorCleared,
  updateProperty,
} from './producersSlice';
import { selectProducerDetail, selectProducerMutation } from './selectors';
import { fetchHarvests } from '../harvests/harvestsSlice';
import { FarmCard } from '../properties/FarmCard';
import { PropertyForm } from '../properties/PropertyForm';
import { CropForm } from '../properties/CropForm';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { SkeletonList } from '../../components/Skeleton';
import { NotFound } from '../../components/NotFound';
import { PencilIcon, PlusIcon, TrashIcon } from '../../icons';
import { formatDocument } from '../../lib/format';
import type { ApiFailure } from '../../lib/httpClient';
import type { CropInput, PropertyDetail, PropertyInput } from './types';

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
  overflow-wrap: anywhere;
`;

const Document = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-variant-numeric: tabular-nums;
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
  flex-wrap: wrap;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
  margin-bottom: ${({ theme }) => theme.space.sm};
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const Farms = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const BackLink = styled(Link)`
  display: inline-block;
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.space.sm};
`;

type Dialog =
  | { kind: 'none' }
  | { kind: 'farm'; farm?: PropertyDetail }
  | { kind: 'crop'; farm: PropertyDetail }
  | { kind: 'deleteProducer' }
  | { kind: 'deleteFarm'; farm: PropertyDetail }
  | { kind: 'deleteCrop'; cropId: string; cropName: string };

/**
 * The whole of User Story 4 lives on this screen, and it loads from a single request:
 * `GET /producers/:id` returns the producer plus its farms, each already carrying its crops
 * grouped by season (research.md R-009).
 *
 * Farm and planting forms are modals rather than routes — they always edit a child of the
 * record already on screen (contracts/routes.md).
 */
export function ProducerDetail() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const detail = useAppSelector(selectProducerDetail);
  const mutation = useAppSelector(selectProducerMutation);
  const harvests = useAppSelector((state) => state.harvests.items);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [serverError, setServerError] = useState<ApiFailure | null>(null);

  useEffect(() => {
    if (id && detail.id !== id) void dispatch(fetchProducer(id));
  }, [dispatch, id, detail.id]);

  useEffect(() => {
    // The planting form selects a season rather than typing one, so the shared list must be
    // loaded here too — read from the harvests slice, never copied into this one (FR-043).
    void dispatch(fetchHarvests());
  }, [dispatch]);

  function closeDialog() {
    setDialog({ kind: 'none' });
    setServerError(null);
    // Dismissing the dialog dismisses its failure too — otherwise the refusal the user just
    // read and closed would reappear as a banner behind it, with no way to clear it.
    dispatch(mutationErrorCleared());
  }

  async function run(action: Promise<{ payload: unknown; type: string }>) {
    const result = await action;
    if (result.type.endsWith('/rejected')) {
      setServerError((result.payload as ApiFailure | undefined) ?? null);
      return false;
    }
    closeDialog();
    return true;
  }

  const busy = mutation.status === 'pending';

  if (detail.request.status === 'failed') {
    return (
      <NotFound
        title="Produtor não encontrado"
        description="Este produtor não existe ou foi removido."
        backTo="/produtores"
        backLabel="Voltar para Produtores"
      />
    );
  }

  // Loading a *different* producer: showing the one in the store would be the wrong record.
  if (!detail.producer || detail.id !== id) return <SkeletonList rows={4} height="8rem" />;

  const producer = detail.producer;

  return (
    <>
      <BackLink to="/produtores">← Voltar para Produtores</BackLink>

      <Head>
        <div>
          <Title>{producer.name}</Title>
          <Document>
            {producer.documentType}: {formatDocument(producer.document)}
          </Document>
        </div>
        <Actions>
          <Button variant="secondary" onClick={() => navigate(`/produtores/${producer.id}/editar`)}>
            <PencilIcon size={16} />
            Editar produtor
          </Button>
          <Button variant="danger" onClick={() => setDialog({ kind: 'deleteProducer' })}>
            <TrashIcon size={16} />
            Excluir produtor
          </Button>
        </Actions>
      </Head>

      <SectionHead>
        <SectionTitle>Fazendas</SectionTitle>
        <Button onClick={() => setDialog({ kind: 'farm' })}>
          <PlusIcon size={16} />
          Nova fazenda
        </Button>
      </SectionHead>

      {mutation.status === 'failed' && dialog.kind === 'none' && mutation.error && (
        <ErrorState message={mutation.error} />
      )}

      {producer.properties.length === 0 ? (
        <EmptyState
          title="Nenhuma fazenda cadastrada"
          description="Cadastre a primeira fazenda deste produtor."
          action={<Button onClick={() => setDialog({ kind: 'farm' })}>Nova fazenda</Button>}
        />
      ) : (
        <Farms>
          {producer.properties.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              onEdit={() => setDialog({ kind: 'farm', farm })}
              onDelete={() => setDialog({ kind: 'deleteFarm', farm })}
              onAddCrop={() => setDialog({ kind: 'crop', farm })}
              onDeleteCrop={(cropId, cropName) =>
                setDialog({ kind: 'deleteCrop', cropId, cropName })
              }
            />
          ))}
        </Farms>
      )}

      {dialog.kind === 'farm' && (
        <Modal title={dialog.farm ? 'Editar fazenda' : 'Nova fazenda'} onClose={closeDialog}>
          <PropertyForm
            property={dialog.farm}
            busy={busy}
            serverError={serverError}
            onCancel={closeDialog}
            onSubmit={(input: PropertyInput) =>
              void run(
                dialog.farm
                  ? dispatch(
                      updateProperty({ producerId: producer.id, id: dialog.farm.id, input }),
                    )
                  : dispatch(createProperty({ producerId: producer.id, input })),
              )
            }
          />
        </Modal>
      )}

      {dialog.kind === 'crop' && (
        <Modal title={`Nova cultura — ${dialog.farm.farmName}`} onClose={closeDialog}>
          <CropForm
            harvests={harvests}
            busy={busy}
            serverError={serverError}
            onCancel={closeDialog}
            onSubmit={(input: CropInput) =>
              void run(
                dispatch(
                  createCrop({
                    producerId: producer.id,
                    propertyId: (dialog as { farm: PropertyDetail }).farm.id,
                    input,
                  }),
                ),
              )
            }
          />
        </Modal>
      )}

      {dialog.kind === 'deleteProducer' && (
        <ConfirmDialog
          title="Excluir produtor"
          message={
            <>
              As fazendas deste produtor e as culturas dessas fazendas também serão removidas.
              Esta ação não pode ser desfeita.
              <br />
              <br />
              As safras permanecem — elas são compartilhadas por todo o cadastro.
            </>
          }
          confirmLabel="Excluir produtor"
          busy={busy}
          error={serverError?.message ?? null}
          onCancel={closeDialog}
          onConfirm={async () => {
            const ok = await run(dispatch(deleteProducer(producer.id)));
            if (ok) navigate('/produtores');
          }}
        />
      )}

      {dialog.kind === 'deleteFarm' && (
        <ConfirmDialog
          title="Excluir fazenda"
          message={`As culturas registradas em ${dialog.farm.farmName} também serão removidas.`}
          confirmLabel="Excluir fazenda"
          busy={busy}
          error={serverError?.message ?? null}
          onCancel={closeDialog}
          onConfirm={() =>
            void run(
              dispatch(
                deleteProperty({
                  producerId: producer.id,
                  id: (dialog as { farm: PropertyDetail }).farm.id,
                }),
              ),
            )
          }
        />
      )}

      {dialog.kind === 'deleteCrop' && (
        <ConfirmDialog
          title="Remover cultura"
          message={`Remover ${dialog.cropName} desta fazenda?`}
          confirmLabel="Remover"
          busy={busy}
          error={serverError?.message ?? null}
          onCancel={closeDialog}
          onConfirm={() =>
            void run(
              dispatch(
                deleteCrop({
                  producerId: producer.id,
                  id: (dialog as { cropId: string }).cropId,
                }),
              ),
            )
          }
        />
      )}
    </>
  );
}
