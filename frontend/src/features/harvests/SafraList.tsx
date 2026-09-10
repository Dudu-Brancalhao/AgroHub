import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  createHarvest,
  deleteHarvest,
  fetchHarvests,
  mutationErrorCleared,
  updateHarvest,
} from './harvestsSlice';
import { validateHarvestYear } from './yearValidation';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { SkeletonList } from '../../components/Skeleton';
import { PencilIcon, PlusIcon, TrashIcon } from '../../icons';
import { transitioned } from '../../styles/motion';
import type { ApiFailure } from '../../lib/httpClient';
import type { Harvest } from './types';

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.space.md};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  max-width: 60ch;
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  flex-wrap: wrap;

  ${transitioned('border-color', '120ms')}

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

const Year = styled(Link)`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  color: inherit;

  &:hover {
    text-decoration: underline;
  }
`;

const RowActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.xs};
`;

type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; harvest?: Harvest }
  | { kind: 'delete'; harvest: Harvest };

function YearForm({
  harvest,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  harvest?: Harvest;
  busy: boolean;
  serverError: ApiFailure | null;
  onSubmit: (year: number) => void;
  onCancel: () => void;
}) {
  const [year, setYear] = useState(harvest ? String(harvest.year) : '');
  const [error, setError] = useState<string | null>(null);

  const fieldError =
    error ??
    // A 409 on a season is always about the year already existing.
    (serverError?.statusCode === 409 ? serverError.message : null) ??
    serverError?.details?.find((detail) => detail.field === 'year')?.message ??
    null;

  const generalError =
    serverError && serverError.statusCode !== 409 && !serverError.details?.length
      ? serverError.message
      : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found = validateHarvestYear(year);
    setError(found);
    if (found) return;

    onSubmit(Number(year.trim()));
  }

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {generalError && <ErrorState message={generalError} />}
      <TextField
        label="Ano da safra"
        value={year}
        error={fieldError}
        inputMode="numeric"
        placeholder="2021"
        onChange={(event) => setYear(event.target.value)}
      />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" busy={busy}>
          {harvest ? 'Salvar' : 'Cadastrar safra'}
        </Button>
      </FormActions>
    </Form>
  );
}

export function SafraList() {
  const dispatch = useAppDispatch();
  const { items, request, mutation } = useAppSelector((state) => state.harvests);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [serverError, setServerError] = useState<ApiFailure | null>(null);

  useEffect(() => {
    if (request.status === 'idle') void dispatch(fetchHarvests());
  }, [dispatch, request.status]);

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
      return;
    }
    closeDialog();
  }

  const busy = mutation.status === 'pending';
  const isLoading = request.status === 'pending' || request.status === 'idle';

  return (
    <>
      <Head>
        <div>
          <Title>Safras</Title>
          <Subtitle>
            As safras são compartilhadas por todo o cadastro: uma safra não pertence a nenhum
            produtor.
          </Subtitle>
        </div>
        <Button onClick={() => setDialog({ kind: 'form' })}>
          <PlusIcon size={16} />
          Nova safra
        </Button>
      </Head>

      {/*
        A failure that outlived its dialog — the dialog was dismissed before the response landed.
        While a dialog is open it shows the refusal itself, so this would only duplicate it.
      */}
      {dialog.kind === 'none' && mutation.status === 'failed' && mutation.error && (
        <ErrorState message={mutation.error} />
      )}

      {request.status === 'failed' ? (
        <ErrorState
          message={request.error ?? 'Não foi possível carregar as safras.'}
          onRetry={() => void dispatch(fetchHarvests())}
        />
      ) : isLoading ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhuma safra cadastrada"
          description="Cadastre uma safra para poder registrar plantios nas fazendas."
          action={<Button onClick={() => setDialog({ kind: 'form' })}>Nova safra</Button>}
        />
      ) : (
        <List>
          {items.map((harvest) => (
            <Row key={harvest.id}>
              <Year to={`/safras/${harvest.id}`}>{harvest.year}</Year>
              <RowActions>
                <Button
                  variant="ghost"
                  aria-label={`Editar safra ${harvest.year}`}
                  onClick={() => setDialog({ kind: 'form', harvest })}
                >
                  <PencilIcon size={16} />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Excluir safra ${harvest.year}`}
                  onClick={() => setDialog({ kind: 'delete', harvest })}
                >
                  <TrashIcon size={16} />
                  Excluir
                </Button>
              </RowActions>
            </Row>
          ))}
        </List>
      )}

      {dialog.kind === 'form' && (
        <Modal title={dialog.harvest ? 'Editar safra' : 'Nova safra'} onClose={closeDialog}>
          <YearForm
            harvest={dialog.harvest}
            busy={busy}
            serverError={serverError}
            onCancel={closeDialog}
            onSubmit={(year) =>
              void run(
                dialog.harvest
                  ? dispatch(updateHarvest({ id: dialog.harvest.id, year }))
                  : dispatch(createHarvest(year)),
              )
            }
          />
        </Modal>
      )}

      {dialog.kind === 'delete' && (
        <ConfirmDialog
          title={`Excluir safra ${dialog.harvest.year}`}
          message={
            <>
              A safra só pode ser excluída se nenhuma fazenda tiver cultura registrada nela.
              <br />
              <br />
              Se houver plantios, a exclusão será recusada e nada será removido.
            </>
          }
          confirmLabel="Excluir safra"
          busy={busy}
          error={serverError?.message ?? null}
          onCancel={closeDialog}
          onConfirm={() =>
            void run(dispatch(deleteHarvest((dialog as { harvest: Harvest }).harvest.id)))
          }
        />
      )}
    </>
  );
}
