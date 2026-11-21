// Seeing: vision cones and line of sight. A guard (or camera) sees the player when the
// player is inside its cone's range and angle and no wall, cover or plant stands between
// them. Plants block sight but not movement; lamps do not block sight at all.
import { LIGHT, SNEAK_SPOT } from './config.js';

function segmentHitsRect(x1, y1, x2, y2, rect) {
  // Slab test: does the segment cross the rectangle?
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function segmentHitsCircle(x1, y1, x2, y2, circle) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;
  let t = ((circle.x - x1) * dx + (circle.y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const distSq = (cx - circle.x) ** 2 + (cy - circle.y) ** 2;
  return distSq < circle.r * circle.r;
}

/** True when nothing solid stands between the two points. */
export function hasLineOfSight(x1, y1, x2, y2, level) {
  for (const wall of level.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  for (const block of level.cover) {
    if (segmentHitsRect(x1, y1, x2, y2, block)) return false;
  }
  for (const plant of level.plants) {
    if (segmentHitsCircle(x1, y1, x2, y2, plant)) return false;
  }
  return true;
}

/** True when the point is inside one of the level's lamp pools. */
export function inLight(x, y, level) {
  for (const lamp of level.lamps) {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < lamp.r * lamp.r) return true;
  }
  return false;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * How clearly a watcher at (x, y) facing `angle` sees the player: 0 when the player is
 * outside the cone or behind cover, rising toward 1 as the player gets closer, stands in
 * the light and moves in the open. Sneaking cuts it nearly in half.
 */
export function visibility(x, y, angle, range, halfAngle, player, level, sneaking) {
  const dx = player.x - x;
  const dy = player.y - y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return 0;
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(toPlayer, angle)) > halfAngle) return 0;
  if (!hasLineOfSight(x, y, player.x, player.y, level)) return 0;
  // Close is obvious, far is a glimpse; light and movement make it worse.
  const closeness = 1 - (distance / range) * 0.65;
  const light = inLight(player.x, player.y, level) ? LIGHT.inLight : LIGHT.inDark;
  const sneak = sneaking ? SNEAK_SPOT : 1;
  const moving = player.moving ? 1.15 : 1;
  return Math.min(1, closeness * light * sneak * moving);
}
