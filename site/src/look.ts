// The viewer's render look: how the 3D previews are drawn, not which asset style is shown.
// Kept free of three.js so the main chunk can read and store the choice before the 3D code loads.

export const LOOKS = ['realistic', 'pixel', 'line', 'halftone'] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_LABEL: Record<Look, string> = { realistic: 'Realistic', pixel: 'Pixel', line: 'Line', halftone: 'Halftone' };

const LOOK_KEY = 'stringbed.look';

export function storedLook(): Look {
  try {
    const v = localStorage.getItem(LOOK_KEY) as Look | null;
    return v && LOOKS.includes(v) ? v : 'realistic';
  } catch {
    return 'realistic';
  }
}

export function storeLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}
