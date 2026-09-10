import { Global, Module } from '@nestjs/common';
import { PrismaThrottlerStorage } from './prisma-throttler.storage';
import { ThrottleCleanupService } from './cleanup.service';

/**
 * Exports the storage as a CLASS token rather than @nestjs/throttler's `ThrottlerStorage` symbol.
 * The symbol is both an interface and a `unique symbol`, and Nest's injector stringifies provider
 * tokens when resolving them — which throws on a symbol.
 */
@Global()
@Module({
  providers: [PrismaThrottlerStorage, ThrottleCleanupService],
  exports: [PrismaThrottlerStorage],
})
export class ThrottlingModule {}
