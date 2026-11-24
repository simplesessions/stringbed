// The detail view's camera maths, kept apart from WebGL so it can be tested: which part of the
// racquet a "show me the throat" button frames, how far a pan may stray, and the glide between views.
import { Box3, MathUtils, Spherical, Vector3, type Object3D } from 'three';
import type { PartView } from './parts';

/** Where the camera looks (`target`) and where it stands, relative to that. */
export interface Pose {
  target: Vector3;
  offset: Vector3;
}

const ofParts = (model: Object3D, names: string[]): Box3 | null => {
  const box = new Box3();
  for (const name of names) {
    const part = model.getObjectByName(name);
    if (part) box.expandByObject(part);
  }
  return box.isEmpty() ? null : box;
};

/**
 * The box each close-up frames, found from the named parts (a public contract, so it holds for any
 * racquet): the head is everything from the string bed up, the handle the grip and cap, and the
 * throat what lies between, with a little of both for context.
 */
export function partBoxes(model: Object3D): Record<PartView, Box3> {
  const all = new Box3().setFromObject(model);
  const strings = ofParts(model, ['strings_mains', 'strings_crosses']) ?? all;
  const grip = ofParts(model, ['grip', 'butt_cap']) ?? all;
  const size = all.getSize(new Vector3());
  const slice = (from: number, to: number) =>
    new Box3(new Vector3(all.min.x, Math.max(all.min.y, from), all.min.z), new Vector3(all.max.x, Math.min(all.max.y, to), all.max.z));
  const bed = strings.min.y;
  const top = grip.max.y;
  const throat = slice(Math.min(top, bed), Math.max(top, bed) + size.y * 0.06);
  // Only the head is as wide as the whole racquet.
  throat.min.x *= 0.7;
  throat.max.x *= 0.7;
  const handle = slice(all.min.y, top);
  handle.min.x = grip.min.x;
  handle.max.x = grip.max.x;
  return { head: slice(bed - size.y * 0.02, all.max.y), throat, handle };
}

/** How far back a camera stands to fit `box` with a margin, whichever way is the tighter fit. */
export function fitDistance(box: Box3, fovDeg: number, aspect: number, margin = 1.16): number {
  const size = box.getSize(new Vector3());
  const tan = Math.tan(MathUtils.degToRad(fovDeg) / 2);
  return (Math.max(size.y, Math.max(size.x, size.z) / aspect) * margin) / (2 * tan);
}

/**
 * Keep the point the camera turns around on the racquet, so a pan can reach every part but never
 * lose it. Beyond the fitted distance the room to roam closes up, so zooming out brings the
 * racquet back to the middle. Writes `target` and returns how far it was moved.
 */
export function holdTarget(target: Vector3, box: Box3, distance: number, fitted: number): Vector3 {
  const centre = box.getCenter(new Vector3());
  const half = box.getSize(new Vector3()).multiplyScalar(0.5);
  const room = 1 - MathUtils.smoothstep(distance / fitted, 1, 1.5);
  const before = target.clone();
  // Depth matters little on screen but a turned view pans along it, so it gets the wider of the two.
  const flat = Math.max(half.x, half.z);
  target.x = MathUtils.clamp(target.x, centre.x - flat * room, centre.x + flat * room);
  target.y = MathUtils.clamp(target.y, centre.y - half.y * room, centre.y + half.y * room);
  target.z = MathUtils.clamp(target.z, centre.z - flat * room, centre.z + flat * room);
  return target.clone().sub(before);
}

/** How much of the alcove is there, 0 to 1 each. */
export interface Presence {
  floor: number;
  wall: number;
}

/**
 * The floor is solid from any ordinary view and gone by the time the camera reaches its level, so
 * the camera never breaks through it. The wall goes later, as the view tips up towards the butt
 * cap and the wall would end.
 */
export function presence(camera: Vector3, target: Vector3, floor: number): Presence {
  const away = Math.hypot(camera.x - target.x, camera.z - target.z);
  const above = MathUtils.radToDeg(Math.atan2(camera.y - floor, away));
  const pitch = MathUtils.radToDeg(Math.atan2(camera.y - target.y, away));
  return { floor: MathUtils.smoothstep(above, 1, 9), wall: MathUtils.smoothstep(pitch, -42, -14) };
}

/** Ease-out with no overshoot: the camera should arrive, not bounce. */
export const ease = (t: number): number => 1 - Math.pow(1 - MathUtils.clamp(t, 0, 1), 4);

/** The pose `t` of the way from `a` to `b`, turning the short way round rather than cutting through. */
export function between(a: Pose, b: Pose, t: number): Pose {
  const from = new Spherical().setFromVector3(a.offset);
  const to = new Spherical().setFromVector3(b.offset);
  let turn = (to.theta - from.theta) % (Math.PI * 2);
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  const at = new Spherical(
    // Zoom by ratio, so a long dolly feels even from end to end.
    from.radius * Math.pow(to.radius / from.radius, t),
    MathUtils.lerp(from.phi, to.phi, t),
    from.theta + turn * t,
  ).makeSafe();
  return { target: a.target.clone().lerp(b.target, t), offset: new Vector3().setFromSpherical(at) };
}
