import { TextField } from './TextField';
import { toInputValue } from '../lib/area';
import type { Centiares } from '../lib/area';

/**
 * An area input that never lets its value become a fractional JavaScript number.
 *
 * The component holds the raw text the user typed and reports `Centiares` upward; parsing lives
 * in `lib/area`. Two decimal places is the fixed scale — the database column, the API and the
 * user's own answer all agree on it (research.md R-004).
 */
export function AreaField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  /** The raw text being edited, so a half-typed "1500," is not destroyed by re-formatting. */
  value: string;
  error?: string | null;
  onChange: (raw: string) => void;
}) {
  return (
    <TextField
      label={label}
      value={value}
      error={error}
      inputMode="decimal"
      hint="Em hectares, com até duas casas decimais."
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Seeds the field when editing an existing farm. */
export function areaToInput(value: Centiares | undefined): string {
  return value === undefined ? '' : toInputValue(value);
}
