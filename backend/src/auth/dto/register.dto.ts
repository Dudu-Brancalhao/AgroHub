import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, Validate } from 'class-validator';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MAX_PASSWORD_BYTES } from '../password.service';

/**
 * bcrypt truncates at 72 BYTES, not 72 characters.
 *
 * `.length` counts UTF-16 code units, so "senhaç…" can pass a 72-character check while exceeding
 * 72 bytes — and everything past the 72nd byte is silently discarded by bcrypt, meaning two
 * different passwords would authenticate the same account (research.md R-001).
 */
@ValidatorConstraint({ name: 'maxPasswordBytes', async: false })
export class MaxPasswordBytes implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;
  }

  defaultMessage(_args: ValidationArguments): string {
    return `A senha excede o limite de ${MAX_PASSWORD_BYTES} bytes.`;
  }
}

export class RegisterDto {
  @ApiProperty({
    format: 'email',
    maxLength: 254,
    description: 'E-mail da conta. Maiúsculas e espaços nas pontas são normalizados.',
    example: 'produtor@agrohub.com.br',
  })
  // Format check only: no MX lookup, no confirmation e-mail, no outbound dependency (FR-003).
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'O e-mail deve ter no máximo 254 caracteres.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: MAX_PASSWORD_BYTES,
    description:
      'Mínimo de 8 caracteres, com pelo menos uma letra e um número. O limite de 72 é contado em bytes.',
    example: 'SenhaSegura1',
  })
  @IsString({ message: 'A senha é obrigatória.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @Validate(MaxPasswordBytes)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).*$/, {
    message: 'A senha deve conter pelo menos uma letra e um número.',
  })
  password!: string;
}
