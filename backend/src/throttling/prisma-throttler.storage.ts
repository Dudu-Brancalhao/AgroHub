import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Postgres-backed storage for @nestjs/throttler.
 *
 * FR-024 requires counters shared across instances, which rules out the default in-memory storage
 * (each instance would keep its own count, so an attacker gets N x the allowance simply by being
 * load-balanced). Redis is the usual answer but is new infrastructure — a Principle VII stack
 * change needing a constitution amendment first, and unnecessary at FR-021's ceiling of 20
 * requests/min/origin (research.md R-005).
 *
 * Everything here sits behind the ThrottlerStorage interface, so swapping to Redis later replaces
 * this one class and nothing else.
 *
 * Note: @nestjs/throttler v6 passes `ttl` and `blockDuration` in MILLISECONDS.
 */
@Injectable()
export class PrismaThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = new Date();
    const compositeKey = `${throttlerName}:${key}`;

    const existing = await this.prisma.throttleRecord.findUnique({ where: { key: compositeKey } });

    // A row past its expiry is treated as absent rather than deleted on read: the cleanup job
    // reclaims it, and this keeps the hot path to a single write.
    const expired = !existing || existing.expiresAt <= now;

    if (existing?.blockedUntil && existing.blockedUntil > now) {
      return {
        totalHits: existing.hits,
        timeToExpire: this.seconds(existing.expiresAt, now),
        isBlocked: true,
        timeToBlockExpire: this.seconds(existing.blockedUntil, now),
      };
    }

    if (expired) {
      const expiresAt = new Date(now.getTime() + ttl);
      await this.prisma.throttleRecord.upsert({
        where: { key: compositeKey },
        create: { key: compositeKey, hits: 1, expiresAt, blockedUntil: null },
        update: { hits: 1, expiresAt, blockedUntil: null },
      });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const updated = await this.prisma.throttleRecord.update({
      where: { key: compositeKey },
      data: { hits: { increment: 1 } },
    });

    if (updated.hits > limit) {
      const blockedUntil = new Date(now.getTime() + (blockDuration || ttl));
      await this.prisma.throttleRecord.update({
        where: { key: compositeKey },
        data: { blockedUntil },
      });
      return {
        totalHits: updated.hits,
        timeToExpire: this.seconds(updated.expiresAt, now),
        isBlocked: true,
        timeToBlockExpire: this.seconds(blockedUntil, now),
      };
    }

    return {
      totalHits: updated.hits,
      timeToExpire: this.seconds(updated.expiresAt, now),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private seconds(target: Date, now: Date): number {
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
  }
}
