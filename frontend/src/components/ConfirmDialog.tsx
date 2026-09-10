import styled from 'styled-components';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ErrorState } from './ErrorState';
import type { ButtonVariant } from './Button';

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
`;

const Message = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.6;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.xs};
`;

/**
 * Title, message and confirm label are all callers' choices on purpose.
 *
 * Deleting a producer cascades to its farms and plantings; deleting a season is refused while
 * anything references it. Those two confirmations must not read alike, and a component that
 * phrased them itself would make them do exactly that (data-model.md → relationships).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  /**
   * A refusal that arrived after confirming — a season still in use, most importantly. It has
   * to be shown here, because the dialog deliberately stays open on failure and the message
   * would otherwise be invisible (FR-041).
   */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <Body>
        {error && <ErrorState message={error} />}
        <Message>{message}</Message>
        <Actions>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Actions>
      </Body>
    </Modal>
  );
}
