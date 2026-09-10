import { DocumentBuilder } from '@nestjs/swagger';

/**
 * The name of the bearer security scheme.
 *
 * Exported and used in BOTH places on purpose. `@ApiBearerAuth()` called with no argument
 * references a scheme called `bearer`, while `.addBearerAuth(options, name)` defines whatever
 * name it is given. If the two drift apart, every operation ends up requiring a scheme that does
 * not exist — Swagger UI still shows the Authorize dialog and still reports "authorized", but
 * sends no Authorization header at all, and every call comes back 401.
 *
 * Passing this constant to both sides makes that drift impossible.
 */
export const BEARER_SCHEME = 'bearerAuth';

/**
 * Builds the OpenAPI document config.
 *
 * Shared by main.ts and the contract test, for the same reason buildValidationPipeOptions is
 * shared: a test that assembles its own lookalike document proves nothing about the one the
 * application actually serves. That is precisely how the scheme-name mismatch above shipped.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('AgroHub - API')
    .setDescription(
      'Cadastro e login de usuários, e o registro de produtores rurais, propriedades, safras e ' +
        'culturas plantadas.\n\n' +
        'O login devolve um token de acesso que deve ser enviado no cabeçalho `Authorization` ' +
        'no formato `Bearer <token>` nas demais chamadas.\n\n' +
        '**Para testar por aqui:** faça login, copie o valor de `accessToken` e cole no botão ' +
        '**Authorize** acima (apenas o token, sem o prefixo `Bearer`).\n\n' +
        '**Importante:** o token expira e **não pode ser renovado**. Quando expirar, é ' +
        'necessário fazer login novamente com e-mail e senha.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cole aqui apenas o accessToken devolvido por POST /auth/login.',
      },
      BEARER_SCHEME,
    )
    .build();
}
