import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { createProducer, fetchProducer, updateProducer } from './producersSlice';
import { selectProducerDetail, selectProducerMutation } from './selectors';
import { ProducerForm } from './ProducerForm';
import { SkeletonList } from '../../components/Skeleton';
import { NotFound } from '../../components/NotFound';
import type { ApiFailure } from '../../lib/httpClient';
import type { ProducerInput } from './types';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
  margin-bottom: ${({ theme }) => theme.space.lg};
`;

export function ProducerFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const detail = useAppSelector(selectProducerDetail);
  const mutation = useAppSelector(selectProducerMutation);

  const [serverError, setServerError] = useState<ApiFailure | null>(null);

  useEffect(() => {
    if (mode === 'edit' && id && detail.id !== id) void dispatch(fetchProducer(id));
  }, [dispatch, mode, id, detail.id]);

  async function handleSubmit(input: ProducerInput) {
    setServerError(null);

    const result =
      mode === 'create'
        ? await dispatch(createProducer(input))
        : await dispatch(updateProducer({ id: id!, input }));

    if (createProducer.fulfilled.match(result) || updateProducer.fulfilled.match(result)) {
      navigate(mode === 'create' ? `/produtores/${result.payload.id}` : `/produtores/${id}`);
      return;
    }

    // Taken from the rejected action rather than the store, because only the action carries the
    // `details` a form needs to mark individual fields (FR-030).
    setServerError((result.payload as ApiFailure | undefined) ?? null);
  }

  if (mode === 'edit') {
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

    // detail.id !== id means we are still loading a *different* producer, so showing the one in
    // the store would briefly display the wrong record's data in the form.
    if (!detail.producer || detail.id !== id) return <SkeletonList rows={3} />;
  }

  return (
    <>
      <Title>{mode === 'create' ? 'Novo produtor' : 'Editar produtor'}</Title>
      <ProducerForm
        initialValues={
          mode === 'edit' && detail.producer
            ? { name: detail.producer.name, document: detail.producer.document }
            : undefined
        }
        submitLabel={mode === 'create' ? 'Cadastrar' : 'Salvar'}
        busy={mutation.status === 'pending'}
        serverError={serverError}
        onSubmit={handleSubmit}
        onCancel={() => navigate(mode === 'create' ? '/produtores' : `/produtores/${id}`)}
      />
    </>
  );
}
