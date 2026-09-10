import styled from 'styled-components';
import { Button } from './Button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
  margin-top: ${({ theme }) => theme.space.md};
  flex-wrap: wrap;
`;

const Status = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
`;

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <Nav aria-label="Paginação">
      <Status aria-live="polite">
        Página {page} de {pageCount}
      </Status>
      <Controls>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon size={16} />
          Anterior
        </Button>
        <Button
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRightIcon size={16} />
        </Button>
      </Controls>
    </Nav>
  );
}
