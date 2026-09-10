import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Boot-time environment validation.
 *
 * The application refuses to start when any of these is missing or malformed. JWT_SECRET in
 * particular has no default and no fallback anywhere in the codebase: a fallback secret is a
 * hardcoded secret, because it is what runs whenever the real one fails to load
 * (research.md R-004).
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required and has no default value' })
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_COST!: number;

  @IsInt()
  @Min(1)
  THROTTLE_TTL!: number;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT!: number;

  @IsInt()
  @Min(1)
  REGISTER_THROTTLE_TTL!: number;

  @IsInt()
  @Min(1)
  REGISTER_THROTTLE_LIMIT!: number;

  @IsInt()
  @Min(1)
  LOGIN_MAX_ATTEMPTS!: number;

  @IsInt()
  @Min(1)
  LOGIN_WINDOW_MINUTES!: number;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsInt()
  PORT?: number;
}

const NUMERIC_KEYS = [
  'BCRYPT_COST',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'REGISTER_THROTTLE_TTL',
  'REGISTER_THROTTLE_LIMIT',
  'LOGIN_MAX_ATTEMPTS',
  'LOGIN_WINDOW_MINUTES',
  'PORT',
] as const;

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const coerced: Record<string, unknown> = { ...raw };

  for (const key of NUMERIC_KEYS) {
    const value = coerced[key];
    if (value === undefined || value === '') {
      delete coerced[key];
      continue;
    }
    const parsed = Number(value);
    coerced[key] = Number.isInteger(parsed) ? parsed : value;
  }

  const config = plainToInstance(EnvironmentVariables, coerced, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join('; '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return config;
}
