import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard.
 *
 * Everything is protected by default (Constitution V), so opening a route requires typing this
 * and surviving review — whereas protection you must remember to add is protection that will
 * eventually be forgotten.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
