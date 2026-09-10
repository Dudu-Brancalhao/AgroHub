import { useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { isValidDocument, stripDocument } from '../../lib/documents';
import { maskDocumentInput } from '../../lib/format';
import type { ApiFailure } from '../../lib/httpClient';
import type { ProducerInput } from './types';

const MAX_NAME_LENGTH = 200;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  max-width: 520px;
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
`;

type FieldErrors = { name?: string; document?: string };

export function validateProducer(input: ProducerInput): FieldErrors {
  const errors: FieldErrors = {};

  const name = input.name.trim();
  if (name === '') errors.name = 'O nome é obrigatório.';
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = 'O nome deve ter no máximo 200 caracteres.';
  }

  if (!isValidDocument(input.document)) errors.document = 'Informe um CPF ou CNPJ válido.';

  return errors;
}

/**
 * Server rejections are bound to the field they concern rather than shown as a banner (FR-030):
 * the envelope's `details[]` names fields directly, and a 409 on a producer is always about the
 * document.
 */
function serverErrorsFor(error: ApiFailure | null): FieldErrors {
  if (!error) return {};

  if (error.details?.length) {
    return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
  }

  if (error.statusCode === 409) return { document: error.message };

  return {};
}

export function ProducerForm({
  initialValues,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  initialValues?: ProducerInput;
  submitLabel: string;
  busy: boolean;
  serverError: ApiFailure | null;
  onSubmit: (input: ProducerInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [document, setDocument] = useState(
    initialValues?.document ? maskDocumentInput(initialValues.document) : '',
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const fromServer = serverErrorsFor(serverError);
  const nameError = errors.name ?? fromServer.name;
  const documentError = errors.document ?? fromServer.document;

  // A server failure with no field attribution still has to be readable somewhere.
  const generalError =
    serverError && !fromServer.name && !fromServer.document ? serverError.message : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const input = { name: name.trim(), document: stripDocument(document) };
    const found = validateProducer(input);

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(input);
  }

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {generalError && <ErrorState message={generalError} />}

      <TextField
        label="Nome"
        value={name}
        error={nameError}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
      />

      <TextField
        label="CPF ou CNPJ"
        value={document}
        error={documentError}
        inputMode="numeric"
        hint="Pode ser digitado com ou sem pontuação."
        onChange={(event) => setDocument(maskDocumentInput(event.target.value))}
      />

      <Actions>
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </Actions>
    </Form>
  );
}
