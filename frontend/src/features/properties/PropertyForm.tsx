import { useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { TextField } from '../../components/TextField';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { AreaField, areaToInput } from '../../components/AreaField';
import { isWithinTotal, parseAreaInput } from '../../lib/area';
import { BRAZILIAN_STATES } from '../../lib/states';
import type { ApiFailure } from '../../lib/httpClient';
import type { PropertyDetail, PropertyInput } from '../producers/types';

const MAX_FARM_NAME = 200;
const MAX_CITY = 120;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: ${({ theme }) => theme.space.md};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.xs};
`;

type Draft = {
  farmName: string;
  city: string;
  state: string;
  totalArea: string;
  arableArea: string;
  vegetationArea: string;
};

export type PropertyFieldErrors = Partial<Record<keyof Draft | 'form', string>>;

/**
 * Every rule the server enforces, checked here only so the user hears about it immediately.
 *
 * The composite rule is the one that must not be got wrong: it is evaluated in integer
 * centiares. In floats, `1000 + 500.11` is `1500.1100000000001`, so a valid 1500.11 ha farm
 * would be refused by the client and accepted by the server (research.md R-004).
 */
export function validateProperty(draft: Draft): {
  errors: PropertyFieldErrors;
  input?: PropertyInput;
} {
  const errors: PropertyFieldErrors = {};

  const farmName = draft.farmName.trim();
  if (farmName === '') errors.farmName = 'O nome da fazenda é obrigatório.';
  else if (farmName.length > MAX_FARM_NAME) {
    errors.farmName = 'O nome da fazenda deve ter no máximo 200 caracteres.';
  }

  const city = draft.city.trim();
  if (city === '') errors.city = 'A cidade é obrigatória.';
  else if (city.length > MAX_CITY) errors.city = 'A cidade deve ter no máximo 120 caracteres.';

  if (!(BRAZILIAN_STATES as readonly string[]).includes(draft.state)) {
    errors.state = 'Informe uma UF brasileira válida.';
  }

  const totalArea = parseAreaInput(draft.totalArea);
  const arableArea = parseAreaInput(draft.arableArea);
  const vegetationArea = parseAreaInput(draft.vegetationArea);

  if (totalArea === null) errors.totalArea = 'Informe a área total em hectares.';
  else if (totalArea < 1) errors.totalArea = 'A área total deve ser maior que zero.';

  if (arableArea === null) errors.arableArea = 'Informe a área agricultável em hectares.';
  if (vegetationArea === null) errors.vegetationArea = 'Informe a área de vegetação em hectares.';

  if (
    totalArea !== null &&
    arableArea !== null &&
    vegetationArea !== null &&
    !isWithinTotal(totalArea, arableArea, vegetationArea)
  ) {
    errors.form =
      'A soma da área agricultável e da vegetação não pode ultrapassar a área total.';
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    input: {
      farmName,
      city,
      state: draft.state,
      totalArea: totalArea!,
      arableArea: arableArea!,
      vegetationArea: vegetationArea!,
    },
  };
}

function toDraft(property?: PropertyDetail): Draft {
  return {
    farmName: property?.farmName ?? '',
    city: property?.city ?? '',
    state: property?.state ?? '',
    totalArea: areaToInput(property?.totalArea),
    arableArea: areaToInput(property?.arableArea),
    vegetationArea: areaToInput(property?.vegetationArea),
  };
}

export function PropertyForm({
  property,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  property?: PropertyDetail;
  busy: boolean;
  serverError: ApiFailure | null;
  onSubmit: (input: PropertyInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(property));
  const [errors, setErrors] = useState<PropertyFieldErrors>({});

  const fromServer: PropertyFieldErrors = serverError?.details?.length
    ? Object.fromEntries(serverError.details.map((detail) => [detail.field, detail.message]))
    : {};

  const generalError =
    errors.form ??
    (serverError && !serverError.details?.length ? serverError.message : undefined);

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const { errors: found, input } = validateProperty(draft);
    setErrors(found);

    if (input) onSubmit(input);
  }

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {generalError && <ErrorState message={generalError} />}

      <TextField
        label="Nome da fazenda"
        value={draft.farmName}
        error={errors.farmName ?? fromServer.farmName}
        maxLength={MAX_FARM_NAME}
        onChange={(event) => set('farmName', event.target.value)}
      />

      <Row>
        <TextField
          label="Cidade"
          value={draft.city}
          error={errors.city ?? fromServer.city}
          maxLength={MAX_CITY}
          onChange={(event) => set('city', event.target.value)}
        />
        <Select
          label="Estado"
          placeholder="Selecione a UF"
          options={BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }))}
          value={draft.state}
          error={errors.state ?? fromServer.state}
          onChange={(event) => set('state', event.target.value)}
        />
      </Row>

      <Row>
        <AreaField
          label="Área total"
          value={draft.totalArea}
          error={errors.totalArea ?? fromServer.totalArea}
          onChange={(value) => set('totalArea', value)}
        />
        <AreaField
          label="Área agricultável"
          value={draft.arableArea}
          error={errors.arableArea ?? fromServer.arableArea}
          onChange={(value) => set('arableArea', value)}
        />
        <AreaField
          label="Área de vegetação"
          value={draft.vegetationArea}
          error={errors.vegetationArea ?? fromServer.vegetationArea}
          onChange={(value) => set('vegetationArea', value)}
        />
      </Row>

      <Actions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" busy={busy}>
          {property ? 'Salvar' : 'Cadastrar fazenda'}
        </Button>
      </Actions>
    </Form>
  );
}
