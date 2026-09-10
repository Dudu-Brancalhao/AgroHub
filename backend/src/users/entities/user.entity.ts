import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

/**
 * The only shape of a user that ever leaves the API.
 *
 * Built by naming three fields explicitly rather than spreading the record and deleting
 * `passwordHash`. The difference matters: with a spread, a column added later is exposed by
 * default and someone must remember to hide it. Here, a new column is invisible until someone
 * deliberately adds it — the omission fails closed (FR-007, FR-019).
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid', example: '3f9a1c7e-2b4d-4a19-9c33-88f0e1d2a5b7' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'produtor@agrohub.com.br' })
  email!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-09T14:32:11.421Z' })
  createdAt!: Date;

  static fromEntity(user: User): UserResponseDto {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
