import { useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { Select } from '../../components/Select';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import type { ApiFailure } from '../../lib/httpClient';
import type { CropInput } from '../producers/types';
import type { Harvest } from '../harvests/types';

const MAX_CROP_NAME = 120;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.xs};
`;

/**
 * The season is selected, never typed (data-model.md → Crop), which is why the harvests list
 * must be loaded before this form is usable.
 *
 * Duplicate detection stays the server's: it normalises the crop name, so a client-side check
 * would disagree at the margins. Its 409 is surfaced on the form instead (FR-037).
 */
export function CropForm({
  harvests,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  harvests: Harvest[];
  busy: boolean;
  serverError: ApiFailure | null;
  onSubmit: (input: CropInput) => void;
  onCancel: () => void;
}) {
  const [harvestId, setHarvestId] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ harvestId?: string; name?: string }>({});

  const fromServer = serverError?.details?.length
    ? Object.fromEntries(serverError.details.map((detail) => [detail.field, detail.message]))
    : {};

  const generalError =
    serverError && !serverError.details?.length ? serverError.message : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = name.trim();
    const found: { harvestId?: string; name?: string } = {};

    if (harvestId === '') found.harvestId = 'Selecione uma safra.';
    if (trimmed === '') found.name = 'O nome da cultura é obrigatório.';
    else if (trimmed.length > MAX_CROP_NAME) {
      found.name = 'O nome da cultura deve ter no máximo 120 caracteres.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({ harvestId, name: trimmed });
  }

  if (harvests.length === 0) {
    return (
      <>
        <ErrorState message="Cadastre uma safra antes de registrar uma cultura." />
        <Actions>
          <Button variant="secondary" onClick={onCancel}>
            Fechar
          </Button>
        </Actions>
      </>
    );
  }

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {generalError && <ErrorState message={generalError} />}

      <Select
        label="Safra"
        placeholder="Selecione uma safra"
        options={harvests.map((harvest) => ({
          value: harvest.id,
          label: String(harvest.year),
        }))}
        value={harvestId}
        error={errors.harvestId ?? fromServer.harvestId}
        onChange={(event) => setHarvestId(event.target.value)}
      />

      <TextField
        label="Cultura"
        value={name}
        error={errors.name ?? fromServer.name}
        maxLength={MAX_CROP_NAME}
        placeholder="Soja, Milho, Café…"
        onChange={(event) => setName(event.target.value)}
      />

      <Actions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" busy={busy}>
          Registrar cultura
        </Button>
      </Actions>
    </Form>
  );
}
