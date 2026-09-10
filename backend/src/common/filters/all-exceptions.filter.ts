import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { ErrorResponseDto, FieldErrorDto } from '../dto/error-response.dto';

/** Marker used by the ValidationPipe to hand aggregated field errors to this filter. */
export interface ValidationErrorPayload {
  message: string;
  details: FieldErrorDto[];
}

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Os dados enviados são inválidos.',
  [HttpStatus.UNAUTHORIZED]: 'Autenticação necessária.',
  [HttpStatus.FORBIDDEN]: 'Acesso negado.',
  [HttpStatus.NOT_FOUND]: 'Recurso não encontrado.',
  [HttpStatus.CONFLICT]: 'Conflito com o estado atual do recurso.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas tentativas. Tente novamente em alguns minutos.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Erro interno. Tente novamente mais tarde.',
};

const ERROR_LABELS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * One response shape for every failure in the API.
 *
 * The split that matters: the full cause and stack are LOGGED (English, technical — Constitution
 * VIII), while the caller receives only the envelope (pt-BR, user-facing) plus a requestId that
 * correlates the two. An unexpected error never leaks its message to the caller, because that
 * message routinely contains connection strings, query fragments, or file paths.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    const status = this.resolveStatus(exception);
    const details = this.resolveDetails(exception);
    const message = this.resolveMessage(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId,
          method: request.method,
          path: request.url,
          status,
          err: exception instanceof Error ? { name: exception.name, message: exception.message } : exception,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        'unhandled exception',
      );
    } else {
      this.logger.warn(
        {
          requestId,
          method: request.method,
          path: request.url,
          status,
          // Present only for @OpaqueValidationErrors DTOs: the caller got a generic 401, so the
          // field-level reason lives here and nowhere else. Field names + constraint keys only.
          validation: this.resolveLogOnlyValidation(exception),
        },
        'request rejected',
      );
    }

    // FR-023: a rate-limited caller must be told when to retry. Both limits land here — the
    // per-origin guard raises ThrottlerException, the per-identifier service raises a 429 with a
    // computed retryAfterSeconds — and both must be indistinguishable to the caller.
    if (status === HttpStatus.TOO_MANY_REQUESTS && !response.getHeader('Retry-After')) {
      response.setHeader('Retry-After', String(this.resolveRetryAfter(exception)));
    }

    const body: ErrorResponseDto = {
      statusCode: status,
      error: ERROR_LABELS[status] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (details.length > 0) {
      body.details = details;
    }

    response.status(status).json(body);
  }

  private resolveLogOnlyValidation(exception: unknown): string[] | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }
    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null && 'logOnlyValidation' in payload) {
      const { logOnlyValidation } = payload as { logOnlyValidation: unknown };
      return Array.isArray(logOnlyValidation) ? (logOnlyValidation as string[]) : undefined;
    }
    return undefined;
  }

  private resolveRetryAfter(exception: unknown): number {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'retryAfterSeconds' in payload) {
        const { retryAfterSeconds } = payload as { retryAfterSeconds: unknown };
        if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
          return Math.ceil(retryAfterSeconds);
        }
      }
    }
    return 60;
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveDetails(exception: unknown): FieldErrorDto[] {
    if (!(exception instanceof HttpException)) {
      return [];
    }
    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null && 'details' in payload) {
      const { details } = payload as ValidationErrorPayload;
      return Array.isArray(details) ? details : [];
    }
    return [];
  }

  private resolveMessage(exception: unknown, status: number): string {
    // Anything 5xx is described generically. The real message is in the log; echoing it to the
    // caller is how connection strings and query fragments end up in a browser console.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return DEFAULT_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
    }

    if (exception instanceof ThrottlerException) {
      return DEFAULT_MESSAGES[HttpStatus.TOO_MANY_REQUESTS];
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return payload;
      }
      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const { message } = payload as { message: unknown };
        if (typeof message === 'string') {
          return message;
        }
      }
    }

    return DEFAULT_MESSAGES[status] ?? 'Erro ao processar a requisição.';
  }
}
