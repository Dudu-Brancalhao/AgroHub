import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { CloseIcon, SearchIcon } from '../icons';
import { transitioned } from '../styles/motion';

export const SEARCH_DEBOUNCE_MS = 300;

const Wrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  max-width: 420px;
`;

const Leading = styled.span`
  position: absolute;
  left: ${({ theme }) => theme.space.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 0;
  pointer-events: none;
`;

const Input = styled.input`
  width: 100%;
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.xl}`};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  font-size: ${({ theme }) => theme.font.size.sm};

  ${transitioned('border-color', '120ms')}

  &:hover {
    border-color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Clear = styled.button`
  position: absolute;
  right: ${({ theme }) => theme.space.xxs};
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

/**
 * FR-023: the list narrows as the user types, without one request per keystroke.
 *
 * The debounce lives here rather than in the thunk so the input stays fully responsive — the
 * typed value updates immediately, only the reported value waits.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  // Keeps the field in step when the value changes from outside — a cleared search, or the
  // browser Back button restoring an earlier query string.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;

    const timer = window.setTimeout(() => onChange(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <Wrapper>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Leading>
        <SearchIcon size={18} />
      </Leading>
      <Input
        id={id}
        type="search"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft !== '' && (
        <Clear
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setDraft('');
            onChange('');
          }}
        >
          <CloseIcon size={16} />
        </Clear>
      )}
    </Wrapper>
  );
}
