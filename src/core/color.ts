/** sRGB hex ("#rrggbb") to linear RGB in 0..1 (the space glTF vertex colours and material factors use). */
export function hexToLinear(hex: string): [number, number, number] {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch(0), ch(1), ch(2)];
}
