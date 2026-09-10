import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorDto {
  @ApiProperty({ example: 'password' })
  field!: string;

  @ApiProperty({ example: 'A senha deve ter no mínimo 8 caracteres.' })
  message!: string;
}

/**
 * The single error envelope for the whole API.
 *
 * Never carries a password, a hash, a token, a stack trace, or a driver message — those go to the
 * log only, correlated by `requestId` (FR-025).
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ description: 'Identificador técnico do tipo de erro (em inglês).', example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    description: 'Mensagem destinada ao usuário final, em português.',
    example: 'Os dados enviados são inválidos.',
  })
  message!: string;

  @ApiPropertyOptional({
    type: [FieldErrorDto],
    description: 'Presente apenas em erros de validação; lista todos os campos inválidos de uma vez.',
  })
  details?: FieldErrorDto[];

  @ApiProperty({ example: '/api/auth/register' })
  path!: string;

  @ApiProperty({ example: '2026-09-09T14:32:11.421Z' })
  timestamp!: string;

  @ApiProperty({
    description: 'Identificador da requisição, para localizar o erro no log.',
    example: '01J7X2K9QF3M8N4P',
  })
  requestId!: string;
}
