// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, play, paused, floor clear, caught,
// game over and win.
//
// ?seed=N fixes the game. ?shot=title|sneak|spotted|vault (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_COIN, EVENT_FILE, EVENT_LEVEL, EVENT_NOTICED, EVENT_THROW, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_THROW, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, readBest(), performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const lastStepPhase = new Map();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.startAmbient();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Take the files, reach the exit unseen.`);
  }

  function handleEvents(events) {
    if (events & EVENT_FILE) {
      audio.pickup();
      announce(`File taken. ${world.state.filesTaken} of ${world.state.files.length}.`);
    }
    if (events & EVENT_THROW) announce('Coin thrown.');
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_NOTICED) {
      audio.noticed();
      announce('A guard thinks they saw something.');
    }
    if (events & EVENT_ALARM) {
      audio.alarm();
      announce('Alarm! Break line of sight!');
    }
    if (events & EVENT_LEVEL) {
      audio.levelDone();
      screen = SCREEN_LEVEL;
      announce(`Floor clear. Score ${world.state.score}.`);
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      if (world.state.over) {
        screen = SCREEN_OVER;
        if (world.state.score > best) {
          best = world.state.score;
          saveBest(best);
        }
        announce(`Game over. Score ${world.state.score}.`);
      } else {
        screen = SCREEN_CAUGHT;
        announce(`Caught. ${world.state.lives} lives left.`);
      }
    }
    if (events & EVENT_WIN) {
      audio.win();
      screen = SCREEN_WIN;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Out unseen. Score ${world.state.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_THROW && screen === SCREEN_PLAY) {
      const pointer = renderer.toField(input.pointer().x, input.pointer().y);
      const target =
        pointer.x >= 0 && pointer.x <= 1280 && pointer.y >= 0 && pointer.y <= 720
          ? pointer
          : {
              x: world.state.player.x + Math.cos(world.state.player.angle) * 150,
              y: world.state.player.y + Math.sin(world.state.player.angle) * 150,
            };
      const events = world.step(0, { x: 0, y: 0 }, input.sneaking(), target);
      handleEvents(events);
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVEL) {
        world.nextLevel();
        screen = SCREEN_PLAY;
        announce(`Playing. ${world.state.level.name}.`);
      } else if (screen === SCREEN_CAUGHT) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function playGuardFootsteps() {
    for (const guard of world.state.guards) {
      const before = lastStepPhase.get(guard.index) ?? 0;
      const after = guard.stepPhase;
      if (Math.floor(after) !== Math.floor(before) && guard.moving) {
        const distance = Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y);
        const pan = Math.max(-1, Math.min(1, (guard.x - world.state.player.x) / 400));
        audio.footstep(distance, pan);
      }
      lastStepPhase.set(guard.index, after);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    const events = world.step(STEP, input.direction(), input.sneaking(), null);
    playGuardFootsteps();
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Meridian Archive. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
