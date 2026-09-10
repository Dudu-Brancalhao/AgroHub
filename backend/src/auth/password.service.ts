import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

/** bcrypt silently truncates input beyond this. See `MAX_PASSWORD_BYTES` usage in RegisterDto. */
export const MAX_PASSWORD_BYTES = 72;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // A throwaway hash, computed once, from a random value that is never a real password.
    // Used by compareWithDummy() to give the account-miss path the same cost as a real
    // comparison (research.md R-003).
    this.dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), this.cost());
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost());
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Burns the same CPU a real comparison would, then reports failure.
   *
   * Without this, an unknown email returns in ~2ms and a wrong password in ~250ms. That gap is
   * measurable over a handful of requests and turns login into an account-existence oracle,
   * defeating FR-009's identical message entirely (FR-010).
   */
  async compareWithDummy(plain: string): Promise<false> {
    await bcrypt.compare(plain, this.dummyHash);
    return false;
  }

  private cost(): number {
    return this.configService.getOrThrow<number>('bcrypt.cost');
  }
}
