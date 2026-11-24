// The close-ups the detail view offers. Kept free of three.js so the main chunk can label the
// buttons before the 3D code loads.
export const PARTS = ['head', 'throat', 'handle'] as const;
export type PartView = (typeof PARTS)[number];
export const PART_LABEL: Record<PartView, string> = { head: 'Head', throat: 'Throat', handle: 'Handle' };
