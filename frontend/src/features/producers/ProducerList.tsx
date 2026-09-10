import { useEffect } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchProducers } from './producersSlice';
import { selectPageCount, selectProducerList } from './selectors';
import { useProducerListParams } from './useProducerListParams';
import { SearchField } from '../../components/SearchField';
import { Pagination } from '../../components/Pagination';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { SkeletonList } from '../../components/Skeleton';
import { PlusIcon } from '../../icons';
import { formatDocument } from '../../lib/format';
import { transitioned } from '../../styles/motion';

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
`;

const Toolbar = styled.div`
  margin-bottom: ${({ theme }) => theme.space.md};
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
`;

const Row = styled.li`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.md};
  box-shadow: ${({ theme }) => theme.shadow.card};

  ${transitioned('box-shadow, transform', '120ms')}

  /* A linha sobe um fio e a sombra abre — o suficiente para responder ao ponteiro sem saltar. */
  &:hover {
    box-shadow: ${({ theme }) => theme.shadow.cardHover};
    transform: translateY(-1px);
  }
`;

const RowLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  text-decoration: none;
  color: inherit;
  flex-wrap: wrap;
`;

const Name = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow-wrap: anywhere;
`;

const Document = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-variant-numeric: tabular-nums;
`;

export function ProducerList() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { search, page, setSearch, setPage } = useProducerListParams();
  const list = useAppSelector(selectProducerList);
  const pageCount = useAppSelector(selectPageCount);

  useEffect(() => {
    void dispatch(fetchProducers({ page, pageSize: list.pageSize, search }));
  }, [dispatch, page, search, list.pageSize]);

  const isLoading = list.request.status === 'pending' || list.request.status === 'idle';
  const hasFailed = list.request.status === 'failed';

  return (
    <>
      <Head>
        <div>
          <Title>Produtores</Title>
          <Subtitle>Produtores rurais cadastrados.</Subtitle>
        </div>
        <Button onClick={() => navigate('/produtores/novo')}>
          <PlusIcon size={16} />
          Novo produtor
        </Button>
      </Head>

      <Toolbar>
        <SearchField
          label="Buscar produtores"
          placeholder="Buscar por nome ou documento"
          value={search}
          onChange={setSearch}
        />
      </Toolbar>

      {hasFailed ? (
        <ErrorState
          message={list.request.error ?? 'Não foi possível carregar os produtores.'}
          onRetry={() => void dispatch(fetchProducers({ page, pageSize: list.pageSize, search }))}
        />
      ) : isLoading ? (
        <SkeletonList rows={5} />
      ) : list.items.length === 0 ? (
        search !== '' ? (
          <EmptyState
            title={`Nenhum produtor encontrado para «${search}»`}
            description="Verifique o termo buscado ou limpe a busca para ver todos."
            action={
              /* Not "Limpar busca": the × inside the field already carries that accessible
                 name, and two controls sharing one name is ambiguous. */
              <Button variant="secondary" onClick={() => setSearch('')}>
                Ver todos os produtores
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhum produtor cadastrado"
            description="Cadastre o primeiro produtor para começar."
            action={<Button onClick={() => navigate('/produtores/novo')}>Novo produtor</Button>}
          />
        )
      ) : (
        <>
          <List>
            {list.items.map((producer) => (
              <Row key={producer.id}>
                <RowLink to={`/produtores/${producer.id}`}>
                  <Name>{producer.name}</Name>
                  <Document>{formatDocument(producer.document)}</Document>
                </RowLink>
              </Row>
            ))}
          </List>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
        </>
      )}
    </>
  );
}
