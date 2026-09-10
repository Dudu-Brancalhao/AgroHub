import { useCallback, useEffect, useId, useRef } from 'react';
import styled from 'styled-components';
import type { ReactNode } from 'react';
import { animated, fadeIn, fadeInUp } from '../styles/motion';
import { CloseIcon } from '../icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space.md};
  background: rgba(30, 42, 33, 0.45);

  ${animated(fadeIn, '120ms', 'ease-out')}
`;

const Panel = styled.div`
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  z-index: ${({ theme }) => theme.zIndex.modal};

  ${animated(fadeInUp, '180ms', 'ease-out')}
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.md} ${theme.space.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceSunken};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: ${({ theme }) => theme.space.xxs};
  line-height: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Body = styled.div`
  padding: ${({ theme }) => theme.space.lg};
`;

/**
 * A dialog that traps focus while open and hands it back on close (FR-056).
 *
 * Forms for farms and plantings, and every delete confirmation, are modals rather than routes:
 * they always edit a child of the record already on screen, carry no state worth bookmarking,
 * and routing them would force a re-fetch of the producer on cancel (contracts/routes.md).
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const focusableElements = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return [];
    return Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
  }, []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const first = focusableElements()[0];
    (first ?? panelRef.current)?.focus();

    return () => {
      // Returning focus is what keeps keyboard users from being dumped at the top of the page
      // every time they close a dialog.
      previouslyFocused.current?.focus();
    };
  }, [focusableElements]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = focusableElements();
      if (elements.length === 0) return;

      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [focusableElements, onClose]);

  return (
    <Overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Panel ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <Header>
          <Title id={titleId}>{title}</Title>
          <CloseButton type="button" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={20} />
          </CloseButton>
        </Header>
        <Body>{children}</Body>
      </Panel>
    </Overlay>
  );
}
