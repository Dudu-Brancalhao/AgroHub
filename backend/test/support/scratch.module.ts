import { Controller, Get, Module } from '@nestjs/common';

/**
 * A route with NO decorator at all.
 *
 * Exists so a test can prove that protection comes from the global APP_GUARD default rather than
 * from a @UseGuards someone remembered to add. If this ever returns 200, every new route in the
 * codebase ships unprotected unless its author thinks to protect it (Constitution V).
 */
@Controller('scratch')
export class ScratchController {
  @Get()
  undecorated(): { reached: boolean } {
    return { reached: true };
  }
}

@Module({ controllers: [ScratchController] })
export class ScratchModule {}
