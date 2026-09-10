import styled, { css } from 'styled-components';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { animated, spin, transitioned } from '../styles/motion';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** True while the request this button triggered is in flight. */
  busy?: boolean;
  fullWidth?: boolean;
};

const variantStyles = {
  primary: css`
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.textInverted};
    border-color: ${({ theme }) => theme.colors.primary};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primaryHover};
      border-color: ${({ theme }) => theme.colors.primaryHover};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceSunken};
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.textInverted};
    border-color: ${({ theme }) => theme.colors.danger};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerHover};
      border-color: ${({ theme }) => theme.colors.dangerHover};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    border-color: transparent;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceSunken};
    }
  `,
} as const;

const StyledButton = styled.button<{ $variant: ButtonVariant; $fullWidth: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.xs};
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.md}`};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};

  ${transitioned('background-color, border-color, color', '120ms')}
  ${({ $variant }) => variantStyles[$variant]}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Spinner = styled.span`
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  ${animated(spin, '600ms', 'linear', 'infinite')}
`;

/**
 * FR-049: a control that triggers a remote operation shows a busy state and ignores repeated
 * activation until it settles.
 *
 * `disabled` alone would do it, but a disabled button loses focus and stops being announced, so
 * the click is swallowed here while the element stays focusable and `aria-busy` tells assistive
 * technology what is happening.
 */
export function Button({
  variant = 'primary',
  busy = false,
  fullWidth = false,
  children,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <StyledButton
      {...props}
      type={type}
      $variant={variant}
      $fullWidth={fullWidth}
      aria-busy={busy}
      onClick={handleClick}
    >
      {busy && <Spinner aria-hidden="true" />}
      {children}
    </StyledButton>
  );
}
