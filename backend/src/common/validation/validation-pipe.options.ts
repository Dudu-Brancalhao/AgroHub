import {
  BadRequestException,
  UnauthorizedException,
  ValidationError,
  ValidationPipeOptions,
} from '@nestjs/common';
import { FieldErrorDto } from '../dto/error-response.dto';
import { hasOpaqueValidation } from './opaque-validation.decorator';

/** Message shared with AuthService, so a malformed login is indistinguishable from a failed one. */
export const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

/**
 * class-validator emits the whitelist rejection in English ("property role should not exist").
 * That string reaches the API caller, so Constitution VIII makes it pt-BR - unlike our own log
 * messages, which stay English.
 */
function localise(constraintKey: string, message: string, field: string): string {
  if (constraintKey === 'whitelistValidation') {
    return `O campo "${field}" não é permitido.`;
  }
  return message;
}

function flatten(errors: ValidationError[], parent = ''): FieldErrorDto[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([key, message]) => ({
      field,
      message: localise(key, message, field),
    }));
    const nested = error.children?.length ? flatten(error.children, field) : [];
    return [...own, ...nested];
  });
}

/**
 * Field names plus CONSTRAINT KEYS only - never the rendered messages.
 *
 * Constraint keys are static identifiers (isEmail, minLength, whitelistValidation), so this
 * cannot echo a submitted value into a log even if someone later adds a validator whose message
 * interpolates $value. That would be an FR-025 breach one careless decorator away.
 */
function logSafeSummary(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.keys(error.constraints ?? {}).map((key) => `${field}:${key}`);
    const nested = error.children?.length ? logSafeSummary(error.children, field) : [];
    return [...own, ...nested];
  });
}

/**
 * Shared by main.ts and the integration suite, so tests exercise the real configuration rather
 * than a lookalike built alongside it.
 *
 * - whitelist + forbidNonWhitelisted is what satisfies FR-006: an unrecognised `role` or
 *   `isAdmin` in the payload is REJECTED, not silently dropped. Dropping is not good enough -
 *   it passes today and becomes a privilege-escalation path the moment a `role` column exists.
 * - The exceptionFactory aggregates every field error into one response (FR-013); Nest's default
 *   returns a flat string array that a client cannot map back to fields.
 * - A DTO marked @OpaqueValidationErrors() is the exception to FR-013: it collapses to the
 *   generic 401 instead, with the detail routed to the log.
 */
export function buildValidationPipeOptions(): ValidationPipeOptions {
  return {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (errors: ValidationError[]) => {
      if (errors.some((error) => hasOpaqueValidation(error.target))) {
        return new UnauthorizedException({
          message: INVALID_CREDENTIALS,
          // Read and logged by AllExceptionsFilter, never serialised into the response body.
          logOnlyValidation: logSafeSummary(errors),
        });
      }

      return new BadRequestException({
        message: 'Os dados enviados são inválidos.',
        details: flatten(errors),
      });
    },
  };
}
