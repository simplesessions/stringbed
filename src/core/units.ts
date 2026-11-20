const METERS_PER_INCH = 0.0254;
const METERS_PER_MM = 0.001;

export function inToM(inches: number): number {
  return inches * METERS_PER_INCH;
}

export function mmToM(mm: number): number {
  return mm * METERS_PER_MM;
}

export function sqInToSqM(sqIn: number): number {
  return sqIn * METERS_PER_INCH * METERS_PER_INCH;
}
