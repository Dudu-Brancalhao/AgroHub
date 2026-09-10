import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { EmptyState } from './EmptyState';

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

/**
 * FR-008: an unmatched address renders inside the shell with a way back — not a blank page and
 * not a silent redirect, which would hide from the visitor that the thing they asked for is not
 * there.
 */
export function NotFound({
  title = 'Página não encontrada',
  description = 'O endereço que você tentou abrir não existe ou foi removido.',
  backTo = '/dashboard',
  backLabel = 'Voltar para o Dashboard',
}: {
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={<BackLink to={backTo}>{backLabel}</BackLink>}
    />
  );
}
