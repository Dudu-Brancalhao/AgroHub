/**
 * Mirrors the server's auth rules exactly, so the client never refuses what the server accepts
 * or promises what it will reject. The server remains the authority (data-model.md → Session).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).*$/;

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'Informe um e-mail válido.';
  if (!EMAIL.test(trimmed)) return 'Informe um e-mail válido.';
  if (trimmed.length > MAX_EMAIL_LENGTH) return 'O e-mail deve ter no máximo 254 caracteres.';
  return null;
}

/**
 * Sign-up only. Applying these on sign-in would lock out an account created before the rules
 * existed — there, the only client-side rule is that a password was typed at all.
 */
export function validateNewPassword(value: string): string | null {
  if (value === '') return 'A senha é obrigatória.';
  if (value.length < MIN_PASSWORD_LENGTH) return 'A senha deve ter no mínimo 8 caracteres.';
  if (!PASSWORD_HAS_LETTER_AND_DIGIT.test(value)) {
    return 'A senha deve conter pelo menos uma letra e um número.';
  }
  return null;
}

export function validateRequiredPassword(value: string): string | null {
  return value === '' ? 'A senha é obrigatória.' : null;
}
