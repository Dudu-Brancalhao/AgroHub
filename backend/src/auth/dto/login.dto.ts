import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { OpaqueValidationErrors } from '../../common/validation/opaque-validation.decorator';

/**
 * Validation failures here return the same generic 401 as a wrong password (see the decorator).
 * Registration keeps itemised errors - a user setting a password needs to know which rule they
 * missed - but on login the caller learns nothing useful from field detail that they did not
 * already know, while an attacker learns how to tell malformed input from bad credentials.
 */
@OpaqueValidationErrors()
export class LoginDto {
  @ApiProperty({ format: 'email', example: 'produtor@agrohub.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  // No length or complexity rules here on purpose: the policy belongs at registration. Applying
  // it at login would reject a valid legacy password and, worse, would tell an attacker which
  // password shapes exist.
  @ApiProperty({ example: 'SenhaSegura1' })
  @IsString({ message: 'A senha é obrigatória.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password!: string;
}
