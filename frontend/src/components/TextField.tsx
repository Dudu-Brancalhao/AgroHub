import { useId } from 'react';
import styled from 'styled-components';
import type { InputHTMLAttributes } from 'react';
import { transitioned } from '../styles/motion';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  /** A pt-BR message. Its presence is what marks the field invalid. */
  error?: string | null;
  hint?: string;
};

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.colors.text};
`;

const Input = styled.input<{ $invalid: boolean }>`
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.sm}`};
  border: 1px solid
    ${({ theme, $invalid }) => ($invalid ? theme.colors.danger : theme.colors.borderStrong)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  font-size: ${({ theme }) => theme.font.size.sm};

  ${transitioned('border-color', '120ms')}

  &:hover:not(:disabled) {
    border-color: ${({ theme, $invalid }) =>
      $invalid ? theme.colors.danger : theme.colors.textMuted};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.surfaceSunken};
    cursor: not-allowed;
  }
`;

const Message = styled.p<{ $tone: 'error' | 'hint' }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme, $tone }) =>
    $tone === 'error' ? theme.colors.danger : theme.colors.textMuted};
`;

export function TextField({ label, error, hint, ...props }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // Only one description is offered at a time: an error supersedes a hint, and announcing both
  // would bury the thing the user needs to act on.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...props}
        id={id}
        $invalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <Message id={errorId} $tone="error" role="alert">
          {error}
        </Message>
      ) : hint ? (
        <Message id={hintId} $tone="hint">
          {hint}
        </Message>
      ) : null}
    </Field>
  );
}
