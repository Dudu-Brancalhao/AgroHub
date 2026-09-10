import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiBadRequestResponse } from '@nestjs/swagger';
import { BEARER_SCHEME } from '../common/swagger/document.config';
import { AuthService } from './auth.service';
import { RegisterRateLimitGuard } from '../throttling/register-rate-limit.guard';
import { LoginResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { UserResponseDto } from '../users/entities/user.entity';
import { AuthenticatedUser } from './types/authenticated-user';

/**
 * HTTP entry point only (Constitution II): parse, delegate, map. Every rule lives in AuthService.
 */
@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RegisterRateLimitGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra um novo usuário',
    description:
      'Cria uma conta com e-mail e senha. A conta fica disponível para login imediatamente — ' +
      'não há etapa de confirmação por e-mail. O e-mail é validado apenas quanto ao formato; ' +
      'o sistema não verifica se a caixa postal existe e não envia nenhuma mensagem. ' +
      'Limite: 5 cadastros por minuto por origem.',
  })
  @ApiCreatedResponse({ description: 'Conta criada com sucesso', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Já existe uma conta com este e-mail', type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Excesso de tentativas', type: ErrorResponseDto })
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto.email, dto.password);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentica um usuário e devolve o token de acesso',
    description:
      'Valida e-mail e senha e devolve um token de acesso. Por segurança, e-mail inexistente, ' +
      'senha incorreta e dados malformados produzem exatamente a mesma resposta 401, sem ' +
      'detalhamento por campo. O motivo técnico fica no log do servidor, associado ao requestId. ' +
      'Após 5 tentativas malsucedidas para o mesmo e-mail em 15 minutos, novas tentativas são ' +
      'recusadas até a janela expirar.',
  })
  @ApiOkResponse({ description: 'Autenticação realizada com sucesso', type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Credenciais inválidas ou corpo malformado — resposta idêntica nos dois casos',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Excesso de tentativas', type: ErrorResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth(BEARER_SCHEME)
  @ApiOperation({
    summary: 'Retorna os dados do usuário autenticado',
    description:
      'Devolve os dados da conta associada ao token enviado. Nunca devolve a senha nem qualquer ' +
      'material derivado dela.',
  })
  @ApiOkResponse({ description: 'Dados do usuário autenticado', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, expirado ou inválido', type: ErrorResponseDto })
  me(@CurrentUser() user: AuthenticatedUser | undefined): Promise<UserResponseDto> {
    // Defensive: on a route that somehow escaped the guard, refuse rather than trust an
    // absent user.
    if (!user) {
      throw new UnauthorizedException('Autenticação necessária.');
    }
    return this.authService.currentUser(user.id);
  }
}
