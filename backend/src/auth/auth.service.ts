import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { UserResponseDto } from '../users/entities/user.entity';
import { LoginResponseDto } from './dto/auth-response.dto';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthenticatedUser } from './types/authenticated-user';

// Imported rather than redeclared: the ValidationPipe returns this exact string for a malformed
// login, so a drift between the two would reintroduce the distinction it exists to remove.
import { INVALID_CREDENTIALS } from '../common/validation/validation-pipe.options';
const EMAIL_TAKEN = 'Já existe uma conta cadastrada com este e-mail.';
const RATE_LIMITED = 'Muitas tentativas. Tente novamente em alguns minutos.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  async register(email: string, password: string): Promise<UserResponseDto> {
    const passwordHash = await this.passwordService.hash(password);

    try {
      const user = await this.usersRepository.create(email, passwordHash);

      // English, technical (Constitution VIII). Carries the id, never the password (FR-025).
      this.logger.log({ userId: user.id, event: 'user.registered' }, 'account registered');

      return UserResponseDto.fromEntity(user);
    } catch (error) {
      // The duplicate check IS the unique constraint. A pre-flight findByEmail would be a
      // check-then-insert race: two simultaneous requests both see "available" and both insert
      // (FR-002).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn({ event: 'user.register.duplicate' }, 'registration rejected: email taken');
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw error;
    }
  }

  /**
   * Verifies a credential pair, or throws the same error either way.
   *
   * Both the "no such account" and the "wrong password" paths run a bcrypt comparison and throw an
   * identical UnauthorizedException, so neither the message (FR-009) nor the response time
   * (FR-010) reveals whether the address is registered.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    const emailKey = email.trim().toLowerCase();

    // Checked BEFORE any password comparison. That ordering is what makes FR-023 hold: a
    // rate-limited caller never learns whether the password was right, because it was never
    // checked.
    const status = await this.loginAttemptService.check(emailKey);
    if (status.limited) {
      throw new HttpException(
        { message: RATE_LIMITED, retryAfterSeconds: status.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.usersRepository.findByEmail(emailKey);

    const matches = user
      ? await this.passwordService.compare(password, user.passwordHash)
      : await this.passwordService.compareWithDummy(password);

    if (!user || !matches) {
      await this.loginAttemptService.recordFailure(emailKey);
      this.logger.warn(
        { emailKey, event: 'auth.login.failed', reason: user ? 'password mismatch' : 'unknown account' },
        'login failed: credential mismatch',
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.loginAttemptService.clear(emailKey);

    return { id: user.id, email: user.email };
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.validateCredentials(email, password);
    const record = await this.usersRepository.findById(user.id);

    if (!record) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const { accessToken, expiresIn } = await this.tokenService.issue(user);

    this.logger.log({ userId: user.id, event: 'auth.login.succeeded' }, 'login succeeded');

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: UserResponseDto.fromEntity(record),
    };
  }

  async currentUser(userId: string): Promise<UserResponseDto> {
    const record = await this.usersRepository.findById(userId);
    if (!record) {
      throw new UnauthorizedException('Autenticação necessária.');
    }
    return UserResponseDto.fromEntity(record);
  }
}
