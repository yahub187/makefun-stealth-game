// The guards: a patrol with a state machine. A guard walks its waypoints and pauses at
// each; when it half-sees you it stops, stares and walks over to look; when it is sure it
// raises the alarm and chases; lose it and it searches where it last saw you, then walks
// back to its patrol. A thrown coin or a footstep pulls it to investigate instead.
import { GUARD } from './config.js';
import { visibility } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

function blocked(x, y, level) {
  for (const wall of level.walls) {
    if (x > wall.x - 14 && x < wall.x + wall.w + 14 && y > wall.y - 14 && y < wall.y + wall.h + 14) return true;
  }
  for (const block of level.cover) {
    if (x > block.x - 14 && x < block.x + block.w + 14 && y > block.y - 14 && y < block.y + block.h + 14) return true;
  }
  return false;
}

/** A guard walks around a blocker instead of through it: try the axes one at a time. */
function stepGuard(guard, tx, ty, speed, dt, level) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  const nx = guard.x + (dx / distance) * step;
  const ny = guard.y + (dy / distance) * step;
  let moved = false;
  if (!blocked(nx, guard.y, level)) {
    guard.x = nx;
    moved = true;
  }
  if (!blocked(guard.x, ny, level)) {
    guard.y = ny;
    moved = true;
  }
  if (moved) {
    guard.angle = Math.atan2(dy, dx);
    guard.moving = true;
  }
  return Math.hypot(tx - guard.x, ty - guard.y) < 3;
}

export function createGuard(def, index) {
  const first = def.waypoints[0];
  return {
    index,
    x: first[0],
    y: first[1],
    angle: 0,
    waypoint: 1 % def.waypoints.length,
    pause: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    lastSeen: null,
    lastSeenAt: -99,
    searchAt: 0,
    searchTimer: 0,
    investigate: null,
    moving: false,
    stepPhase: index * 0.7,
    waypoints: def.waypoints,
    speed: def.speed ?? GUARD.patrolSpeed,
    range: def.range ?? GUARD.viewRange,
    halfAngle: def.halfAngle ?? GUARD.viewHalfAngle,
  };
}

export function updateGuard(guard, dt, now, player, level, events) {
  guard.moving = false;

  // Seeing: suspicion rises in the open, falls when hidden.
  const seen = visibility(guard.x, guard.y, guard.angle, guard.range, guard.halfAngle, player, level, player.sneaking);
  if (seen > 0) {
    guard.suspicion = Math.min(1, guard.suspicion + seen * GUARD.spotRate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lastSeenAt = now;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.calmRate * dt);
  }

  const was = guard.state;
  if (guard.suspicion >= 1 && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    events.alarm = true;
  } else if (guard.state === GUARD_PATROL && guard.suspicion >= GUARD.suspiciousAt) {
    guard.state = GUARD_SUSPICIOUS;
  } else if (guard.state === GUARD_SUSPICIOUS && guard.suspicion < GUARD.suspiciousAt * 0.5) {
    guard.state = GUARD_PATROL;
  }

  if (guard.state === GUARD_ALERT) {
    // Chase the player while seen; keep hunting a while after losing sight.
    if (guard.lastSeen && now - guard.lastSeenAt < GUARD.huntMemory) {
      const target = seen > 0 ? player : guard.lastSeen;
      stepGuard(guard, target.x, target.y, GUARD.chaseSpeed, dt, level);
    } else {
      guard.state = GUARD_SEARCH;
      guard.searchTimer = GUARD.searchTime;
    }
    if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) {
      events.caught = true;
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    // Walk toward where the glimpse came from, slow and looking.
    if (guard.lastSeen) stepGuard(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.suspiciousSpeed, dt, level);
  } else if (guard.state === GUARD_SEARCH) {
    guard.searchTimer -= dt;
    if (guard.lastSeen) {
      if (stepGuard(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.suspiciousSpeed, dt, level)) {
        guard.angle += dt * 1.4;
      }
    }
    if (guard.searchTimer <= 0) {
      guard.state = GUARD_RETURN;
      guard.suspicion = 0;
    }
  } else if (guard.state === GUARD_RETURN) {
    const home = guard.waypoints[guard.waypoint];
    if (stepGuard(guard, home[0], home[1], GUARD.patrolSpeed, dt, level)) {
      guard.state = GUARD_PATROL;
      guard.pause = 0;
    }
  } else {
    // Patrol: walk the waypoints, pausing and looking around at each one.
    if (guard.pause > 0) {
      guard.pause -= dt;
      guard.angle += dt * 0.9;
    } else if (guard.investigate) {
      const spot = guard.investigate;
      if (stepGuard(guard, spot.x, spot.y, GUARD.suspiciousSpeed, dt, level)) {
        guard.investigate = null;
        guard.pause = GUARD.waypointPause;
      }
    } else {
      const target = guard.waypoints[guard.waypoint];
      if (stepGuard(guard, target[0], target[1], guard.speed, dt, level)) {
        guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
        guard.pause = GUARD.waypointPause;
      }
    }
  }

  if (was !== guard.state && guard.state === GUARD_SUSPICIOUS) events.noticed = true;
  guard.stepPhase += dt * (guard.moving ? 9 : 0);
  return guard;
}

/** A noise somewhere pulls every guard in earshot toward it. */
export function investigateNoise(guards, x, y, radius) {
  for (const guard of guards) {
    if (guard.state === GUARD_ALERT) continue;
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < radius) {
      guard.investigate = { x, y };
      if (guard.state === GUARD_PATROL) guard.state = GUARD_SUSPICIOUS;
      guard.suspicion = Math.max(guard.suspicion, GUARD.suspiciousAt);
    }
  }
}

/** A camera's alarm sends every guard to the spot it saw, right now. */
export function raiseCameraAlarm(guards, x, y, now) {
  for (const guard of guards) {
    if (guard.state !== GUARD_ALERT) {
      guard.state = GUARD_ALERT;
      guard.lastSeen = { x, y };
      guard.lastSeenAt = now;
    }
  }
}
