// The game's rules and state, with no drawing and no browser in it: the player, the guards,
// the cameras, the files, the coins, the noise, the scoring and the level flow. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the small event objects the loop reads.
import { CAMERA, COIN, FIELD, FILES_PER_LEVEL, GUARD, LIVES, PLAYER, SCORE, TIME_PAR } from './config.js';
import { LEVELS } from './levels.js';
import { createGuard, investigateNoise, raiseCameraAlarm, updateGuard } from './guards.js';
import { visibility } from './vision.js';

export const EVENT_FILE = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WIN = 8;
export const EVENT_ALARM = 16;
export const EVENT_NOTICED = 32;
export const EVENT_COIN = 64;
export const EVENT_THROW = 128;

function circleHitsRect(x, y, radius, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: 0, moving: false, sneaking: false },
    guards: [],
    cameras: [],
    files: [],
    coins: [],
    thrown: [],
    score: 0,
    lives: LIVES,
    filesTaken: 0,
    coinsLeft: COIN.perLevel,
    elapsed: 0,
    levelTime: 0,
    detections: 0,
    ghost: true,
    over: false,
    won: false,
    levelDone: false,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.player.x;
    state.player.y = level.player.y;
    state.player.angle = 0;
    state.player.moving = false;
    state.player.sneaking = false;
    state.guards = level.guards.map((def, i) => createGuard(def, i));
    state.cameras = level.cameras.map((def) => ({
      x: def.x,
      y: def.y,
      base: def.base,
      sweep: def.sweep,
      angle: def.base,
      sweepDir: 1,
      suspicion: 0,
      range: CAMERA.viewRange,
      halfAngle: CAMERA.viewHalfAngle,
    }));
    state.files = level.files.map((file) => ({ x: file.x, y: file.y, taken: false }));
    state.coins = [];
    state.thrown = [];
    state.filesTaken = 0;
    state.coinsLeft = COIN.perLevel;
    state.levelTime = 0;
    state.levelDone = false;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.elapsed = 0;
    state.detections = 0;
    state.ghost = true;
    state.over = false;
    state.won = false;
    loadLevel(0);
  }

  function collide(x, y) {
    const radius = PLAYER.radius;
    for (const wall of state.level.walls) {
      if (circleHitsRect(x, y, radius, wall)) return true;
    }
    for (const block of state.level.cover) {
      if (circleHitsRect(x, y, radius, block)) return true;
    }
    return false;
  }

  function movePlayer(direction, sneaking, dt) {
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const length = Math.hypot(direction.x, direction.y);
    const player = state.player;
    player.sneaking = sneaking;
    player.moving = length > 0;
    if (length === 0) return;
    const nx = direction.x / length;
    const ny = direction.y / length;
    player.angle = Math.atan2(ny, nx);
    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    if (!collide(player.x + stepX, player.y)) player.x += stepX;
    if (!collide(player.x, player.y + stepY)) player.y += stepY;
    player.x = Math.max(PLAYER.radius + 2, Math.min(FIELD.width - PLAYER.radius - 2, player.x));
    player.y = Math.max(PLAYER.radius + 2, Math.min(FIELD.height - PLAYER.radius - 2, player.y));
  }

  function throwCoin(targetX, targetY) {
    if (state.coinsLeft <= 0) return false;
    const player = state.player;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    const range = Math.min(distance, COIN.range);
    const landX = player.x + (distance === 0 ? 0 : (dx / distance) * range);
    const landY = player.y + (distance === 0 ? 0 : (dy / distance) * range);
    state.coinsLeft -= 1;
    state.thrown.push({ x: landX, y: landY, timer: 0.4 });
    investigateNoise(state.guards, landX, landY, COIN.clinkRadius);
    return true;
  }

  function step(dt, direction, sneaking, throwAt) {
    if (state.over || state.won || state.levelDone) return 0;
    let events = 0;
    state.elapsed += dt;
    state.levelTime += dt;

    movePlayer(direction, sneaking, dt);

    if (throwAt) {
      if (throwCoin(throwAt.x, throwAt.y)) events |= EVENT_THROW;
    }

    // A thrown coin clinks once when it lands.
    for (const coin of state.thrown) {
      coin.timer -= dt;
      if (coin.timer <= 0 && !coin.clinked) {
        coin.clinked = true;
        events |= EVENT_COIN;
      }
    }
    state.thrown = state.thrown.filter((coin) => coin.timer > -1.2);

    // Walking makes noise: guards close by come to look.
    if (state.player.moving && !state.player.sneaking) {
      investigateNoise(state.guards, state.player.x, state.player.y, PLAYER.noiseRadius);
    }

    // The guards see, chase and catch.
    const guardEvents = { alarm: false, caught: false, noticed: false };
    for (const guard of state.guards) {
      updateGuard(guard, dt, state.levelTime, state.player, state.level, guardEvents);
    }
    if (guardEvents.alarm) {
      events |= EVENT_ALARM;
      state.detections += 1;
      state.ghost = false;
    }
    if (guardEvents.noticed) events |= EVENT_NOTICED;
    if (guardEvents.caught) {
      events |= EVENT_CAUGHT;
      state.lives -= 1;
      if (state.lives <= 0) {
        state.over = true;
      } else {
        loadLevel(state.levelIndex);
      }
      return events;
    }

    // The cameras sweep and watch: one that is sure sends every guard to the spot.
    for (const camera of state.cameras) {
      camera.angle += camera.sweepDir * CAMERA.sweepSpeed * dt;
      const edge = camera.base + camera.sweep;
      if (camera.angle > edge) {
        camera.angle = edge;
        camera.sweepDir = -1;
      } else if (camera.angle < camera.base - camera.sweep) {
        camera.angle = camera.base - camera.sweep;
        camera.sweepDir = 1;
      }
      const seen = visibility(camera.x, camera.y, camera.angle, camera.range, camera.halfAngle, state.player, state.level, state.player.sneaking);
      if (seen > 0) {
        camera.suspicion = Math.min(1, camera.suspicion + seen * CAMERA.spotRate * dt);
      } else {
        camera.suspicion = Math.max(0, camera.suspicion - 0.3 * dt);
      }
      if (camera.suspicion >= 1) {
        camera.suspicion = 0.4;
        raiseCameraAlarm(state.guards, state.player.x, state.player.y, state.levelTime);
        events |= EVENT_ALARM;
        state.detections += 1;
        state.ghost = false;
      }
    }

    // Pick up a sealed file by walking over it.
    for (const file of state.files) {
      if (!file.taken && Math.hypot(file.x - state.player.x, file.y - state.player.y) < 26) {
        file.taken = true;
        state.filesTaken += 1;
        state.score += SCORE.file;
        events |= EVENT_FILE;
      }
    }

    // Reach the exit with every file to finish the floor.
    if (state.filesTaken >= FILES_PER_LEVEL) {
      const exit = state.level.exit;
      const player = state.player;
      if (
        player.x > exit.x - 8 && player.x < exit.x + exit.w + 8 &&
        player.y > exit.y - 8 && player.y < exit.y + exit.h + 8
      ) {
        const timeBonus = Math.max(0, Math.round((TIME_PAR[state.levelIndex] - state.levelTime) * 4));
        state.score += SCORE.level + timeBonus;
        if (state.levelIndex + 1 >= LEVELS.length) {
          state.won = true;
          if (state.ghost) state.score += SCORE.ghost;
          events |= EVENT_WIN;
        } else {
          state.levelDone = true;
          events |= EVENT_LEVEL;
        }
      }
    }

    return events;
  }

  function nextLevel() {
    loadLevel(state.levelIndex + 1);
  }

  reset();
  return { state, reset, loadLevel, step, nextLevel };
}
