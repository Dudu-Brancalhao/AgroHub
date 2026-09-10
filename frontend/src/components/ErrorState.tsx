import styled from 'styled-components';
import { AlertIcon } from '../icons';
import { Button } from './Button';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => theme.space.xl} ${({ theme }) => theme.space.lg};
  text-align: center;
  background: ${({ theme }) => theme.colors.dangerSoft};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
  color: ${({ theme }) => theme.colors.text};
`;

const IconCircle = styled.span`
  color: ${({ theme }) => theme.colors.danger};
`;

const Message = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  max-width: 52ch;
`;

/**
 * FR-050: a failed operation shows a readable pt-BR explanation and, where retrying is
 * meaningful, a retry action. The message comes from the API's envelope or the client's own
 * fallback — never a raw status or stack (SC-006).
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Wrapper role="alert">
      <IconCircle>
        <AlertIcon size={28} />
      </IconCircle>
      <Message>{message}</Message>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Wrapper>
  );
}
