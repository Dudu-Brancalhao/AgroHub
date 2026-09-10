import { useEffect } from 'react';
import styled from 'styled-components';
import { animated, fadeInUp } from '../styles/motion';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { toastDismissed } from '../features/ui/uiSlice';
import type { Toast as ToastModel } from '../features/ui/uiSlice';
import { CheckIcon, AlertIcon, CloseIcon } from '../icons';

const DISMISS_AFTER_MS = 5000;

const Region = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.space.md};
  bottom: ${({ theme }) => theme.space.md};
  z-index: ${({ theme }) => theme.zIndex.toast};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
  max-width: min(90vw, 420px);
`;

const Item = styled.div<{ $kind: ToastModel['kind'] }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space.xs};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  border-radius: ${({ theme }) => theme.radii.md};
  box-shadow: ${({ theme }) => theme.shadow.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ theme, $kind }) =>
    $kind === 'success' ? theme.colors.successSoft : theme.colors.dangerSoft};
  border: 1px solid
    ${({ theme, $kind }) => ($kind === 'success' ? theme.colors.success : theme.colors.danger)};
  color: ${({ theme }) => theme.colors.text};

  ${animated(fadeInUp, '180ms', 'ease-out')}
`;

const Text = styled.span`
  flex: 1;
`;

const DismissButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 0;
`;

function Toast({ toast }: { toast: ToastModel }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch(toastDismissed(toast.id)), DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [dispatch, toast.id]);

  return (
    <Item $kind={toast.kind}>
      {toast.kind === 'success' ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
      <Text>{toast.message}</Text>
      <DismissButton
        type="button"
        aria-label="Fechar aviso"
        onClick={() => dispatch(toastDismissed(toast.id))}
      >
        <CloseIcon size={16} />
      </DismissButton>
    </Item>
  );
}

/**
 * FR-051: a brief, self-dismissing confirmation that does not block interaction.
 *
 * `role="status"` rather than `role="alert"`: a success confirmation should be announced without
 * interrupting whatever the user is doing next.
 */
export function ToastRegion() {
  const toasts = useAppSelector((state) => state.ui.toasts);

  return (
    <Region role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </Region>
  );
}
