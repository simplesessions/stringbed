import type { Finish } from '../core/spec';

/** PBR roughness of each finish. Shared by the published files and by anything put on them later. */
export const ROUGHNESS: Record<Finish, number> = { matte: 0.85, satin: 0.55, gloss: 0.25 };
