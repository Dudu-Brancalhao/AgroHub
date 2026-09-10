import { useId } from 'react';
import styled from 'styled-components';
import type { SelectHTMLAttributes } from 'react';
import { transitioned } from '../styles/motion';

type Option = { value: string; label: string };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string | null;
};

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledSelect = styled.select<{ $invalid: boolean }>`
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
`;

const ErrorText = styled.p`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

export function Select({ label, options, placeholder, error, ...props }: SelectProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <StyledSelect
        {...props}
        id={id}
        $invalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </StyledSelect>
      {error && (
        <ErrorText id={errorId} role="alert">
          {error}
        </ErrorText>
      )}
    </Field>
  );
}
