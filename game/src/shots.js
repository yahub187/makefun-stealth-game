// The screenshot scenes behind ?shot=title|sneak|spotted|vault. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (walk the waypoints, sneak where the scene says so), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_ALARM, EVENT_CAUGHT } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Steer the player toward the current waypoint; returns the direction and sneak flag. */
function seek(state, waypoint, sneak) {
  const dx = waypoint[0] - state.player.x;
  const dy = waypoint[1] - state.player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 12) return { done: true, direction: { x: 0, y: 0 }, sneak };
  return { done: false, direction: { x: dx / distance, y: dy / distance }, sneak };
}

/** The most suspicious guard, if any guard is onto the player. */
function hottestGuard(state) {
  let hottest = null;
  for (const guard of state.guards) {
    if (hottest === null || guard.suspicion > hottest.suspicion) hottest = guard;
  }
  return hottest && hottest.suspicion > 0.3 ? hottest : null;
}

/**
 * Run directly away from the hottest guard, at full walk speed. The run is straight away
 * on purpose: any sideways bias throws away the speed that keeps the guard from closing
 * in, and a biased run pins the player against a wall. A chasing guard gains only
 * 3 px/s on a straight run, so the scene has seconds before any catch.
 */
function fleeDirection(state) {
  const guard = hottestGuard(state);
  if (!guard) return null;
  const dx = state.player.x - guard.x;
  const dy = state.player.y - guard.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function runWaypoints(world, waypoints, sneak, maxSeconds, stopOnAlarm) {
  let index = 0;
  let alarmed = false;
  const limit = Math.floor(maxSeconds / STEP);
  for (let step = 0; step < limit; step += 1) {
    // A guard onto the player outranks the route: run until it loses the scent.
    const flee = fleeDirection(world.state);
    if (flee) {
      const events = world.step(STEP, flee, false, null);
      if (events & EVENT_CAUGHT) break;
      if (events & EVENT_ALARM) {
        alarmed = true;
        if (stopOnAlarm) break;
      }
      continue;
    }
    const waypoint = waypoints[index];
    const move = seek(world.state, waypoint, sneak);
    if (move.done) {
      // Last waypoint reached: the scene is set. Otherwise advance to the next leg.
      if (index >= waypoints.length - 1) break;
      index += 1;
      continue;
    }
    const events = world.step(STEP, move.direction, move.sneak, null);
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_ALARM) {
      alarmed = true;
      // Freeze on the alarm itself: the frame shows the red cone, the "!" and the
      // banner, with the guard still closing in and the player not yet caught.
      if (stopOnAlarm) break;
    }
  }
  return alarmed;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * title: the title screen over floor 1, guards mid-patrol.
 * sneak: Wren crouched in the dark lane below the patrol, a cone sweeping past.
 * spotted: Wren walks into the patrol lane and is caught in the open — the alarm.
 * vault: floor 3, Wren sneaking toward the vault past the centre guard.
 */
export function stageShot(name, world) {
  if (name === 'sneak') {
    world.loadLevel(0);
    runWaypoints(world, [[430, 640], [600, 640], [600, 470], [430, 470]], true, 16, false);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'spotted') {
    world.loadLevel(0);
    // Walk into the patrol lane; freeze the moment a guard raises the alarm, so the
    // frame shows the alarm itself — the red cone, the "!" and the banner — with the
    // guard still closing in and the player not yet caught.
    const alarmed = runWaypoints(world, [[260, 640], [260, 440], [500, 440], [500, 340]], false, 25, true);
    if (!alarmed) {
      const limit = Math.floor(12 / STEP);
      for (let step = 0; step < limit; step += 1) {
        // Stand in the lane, but run when a guard gets onto the player, so the alarm
        // frame catches the chase starting — never the catch itself.
        const flee = fleeDirection(world.state);
        const direction = flee ?? { x: 0, y: 0 };
        const events = world.step(STEP, direction, false, null);
        if (events & EVENT_ALARM) break;
        if (events & EVENT_CAUGHT) break;
      }
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'vault') {
    world.loadLevel(2);
    runWaypoints(world, [[400, 80], [400, 300]], true, 40, false);
    return { screen: SCREEN_PLAY };
  }
  world.loadLevel(0);
  for (let index = 0; index < 5 / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, null);
  }
  return { screen: SCREEN_TITLE };
}
