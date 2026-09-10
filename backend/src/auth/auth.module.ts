import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptRepository } from './login-attempt.repository';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        // Set once, here. No call site passes its own expiresIn, so none can mint a
        // longer-lived token (research.md R-004, R-012).
        signOptions: {
          // @types/jsonwebtoken types expiresIn as a `ms` template literal, which a value read
          // from the environment cannot satisfy statically. Boot validation already guarantees
          // the string is present; the format is covered by TokenService.expiresInSeconds tests.
          expiresIn: config.getOrThrow<string>('jwt.expiresIn') as JwtSignOptions['expiresIn'],
          algorithm: 'HS256',
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    LoginAttemptService,
    LoginAttemptRepository,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
