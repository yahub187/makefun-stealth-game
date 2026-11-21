// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Night lighting is a dark overlay with holes punched at the lamps, the player and
// the exit, so the light pools read as the safe and dangerous places they are. Flat shapes
// and canvas text for the HUD and the panels.
import { FIELD, FONT, PALETTE } from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL = 'level';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const TILE = 80;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = FIELD.width;
  lightCanvas.height = FIELD.height;
  const light = lightCanvas.getContext('2d');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left') {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align = 'left') {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, w, h, 10);
    context.fill();
    context.stroke();
  }

  function drawFloor(state) {
    for (let y = 0; y < FIELD.height; y += TILE) {
      for (let x = 0; x < FIELD.width; x += TILE) {
        const even = ((x + y) / TILE) % 2 === 0;
        context.fillStyle = even ? PALETTE.floor : PALETTE.floorAlt;
        context.fillRect(x, y, TILE, TILE);
      }
    }
    // A worn carpet runner down the middle of the room.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(0, 336, FIELD.width, 48);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(0, 336, FIELD.width, 3);
    context.fillRect(0, 381, FIELD.width, 3);
  }

  function drawLampGlow(state) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const lamp of state.level.lamps) {
      const gradient = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
      gradient.addColorStop(0, 'rgba(255, 210, 138, 0.20)');
      gradient.addColorStop(1, 'rgba(255, 210, 138, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawWallsAndCover(state) {
    for (const wall of state.level.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      if (wall.h <= 24) context.fillRect(wall.x, wall.y, wall.w, 3);
      else context.fillRect(wall.x, wall.y, 3, wall.h);
    }
    for (const block of state.level.cover) {
      if (block.kind === 'shelf') {
        context.fillStyle = PALETTE.shelf;
        context.fillRect(block.x, block.y, block.w, block.h);
        context.fillStyle = PALETTE.shelfEdge;
        context.fillRect(block.x, block.y, block.w, 4);
        context.fillRect(block.x, block.y + block.h - 4, block.w, 4);
        context.fillStyle = PALETTE.shelfBooks;
        const horizontal = block.w > block.h;
        const count = Math.floor((horizontal ? block.w : block.h) / 18);
        for (let i = 0; i < count; i += 1) {
          if (horizontal) context.fillRect(block.x + 8 + i * 18, block.y + 10, 10, block.h - 20);
          else context.fillRect(block.x + 10, block.y + 8 + i * 18, block.w - 20, 10);
        }
      } else {
        context.fillStyle = PALETTE.crate;
        context.fillRect(block.x, block.y, block.w, block.h);
        context.strokeStyle = PALETTE.crateEdge;
        context.lineWidth = 3;
        context.strokeRect(block.x + 3, block.y + 3, block.w - 6, block.h - 6);
        context.beginPath();
        context.moveTo(block.x, block.y);
        context.lineTo(block.x + block.w, block.y + block.h);
        context.moveTo(block.x + block.w, block.y);
        context.lineTo(block.x, block.y + block.h);
        context.stroke();
      }
    }
    for (const plant of state.level.plants) {
      context.fillStyle = PALETTE.plant;
      context.beginPath();
      context.arc(plant.x, plant.y, plant.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.plantEdge;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.6;
        context.beginPath();
        context.arc(plant.x + Math.cos(a) * plant.r * 0.45, plant.y + Math.sin(a) * plant.r * 0.45, plant.r * 0.3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawExit(state, now) {
    const exit = state.level.exit;
    const open = state.filesTaken >= state.files.length;
    const pulse = open ? 0.65 + Math.sin(now * 5) * 0.25 : 0.45;
    context.save();
    context.globalAlpha = pulse;
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x - 4, exit.y - 4, exit.w + 8, exit.h + 8);
    context.restore();
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.fillStyle = PALETTE.exitEdge;
    context.fillRect(exit.x, exit.y, exit.w, 3);
    if (open) {
      context.fillStyle = PALETTE.exit;
      text('EXIT', exit.x + exit.w / 2, exit.y - 12, 15, PALETTE.exit, 'center');
    }
  }

  function drawFiles(state, now) {
    for (const file of state.files) {
      if (file.taken) continue;
      const pulse = 0.5 + Math.sin(now * 3 + file.x) * 0.2;
      context.save();
      context.globalAlpha = pulse;
      context.fillStyle = PALETTE.file;
      context.beginPath();
      context.arc(file.x, file.y, 20, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = PALETTE.file;
      context.fillRect(file.x - 8, file.y - 10, 16, 20);
      context.fillStyle = PALETTE.fileEdge;
      context.fillRect(file.x - 8, file.y - 10, 16, 3);
      context.fillRect(file.x - 4, file.y - 3, 8, 2);
      context.fillRect(file.x - 4, file.y + 2, 8, 2);
      context.fillRect(file.x - 4, file.y + 7, 8, 2);
    }
  }

  function drawLighting(state) {
    light.clearRect(0, 0, FIELD.width, FIELD.height);
    light.fillStyle = 'rgba(4, 5, 9, 0.44)';
    light.fillRect(0, 0, FIELD.width, FIELD.height);
    light.globalCompositeOperation = 'destination-out';
    for (const lamp of state.level.lamps) {
      const gradient = light.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.r * 1.1);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      light.fillStyle = gradient;
      light.beginPath();
      light.arc(lamp.x, lamp.y, lamp.r * 1.1, 0, Math.PI * 2);
      light.fill();
    }
    const player = state.player;
    const halo = light.createRadialGradient(player.x, player.y, 8, player.x, player.y, 130);
    halo.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    light.fillStyle = halo;
    light.beginPath();
    light.arc(player.x, player.y, 130, 0, Math.PI * 2);
    light.fill();
    light.globalCompositeOperation = 'source-over';
    context.drawImage(lightCanvas, 0, 0);
  }

  function drawCone(x, y, angle, range, halfAngle, color) {
    const gradient = context.createRadialGradient(x, y, 10, x, y, range);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255, 226, 140, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, camera.range, camera.halfAngle, PALETTE.cameraCone);
    }
    for (const guard of state.guards) {
      const color =
        guard.state === GUARD_ALERT
          ? PALETTE.coneAlert
          : guard.state === GUARD_SUSPICIOUS
            ? PALETTE.coneSuspicious
            : PALETTE.cone;
      drawCone(guard.x, guard.y, guard.angle, guard.range, guard.halfAngle, color);
    }
  }

  function drawGuards(state, now) {
    for (const guard of state.guards) {
      context.fillStyle = guard.state === GUARD_ALERT ? PALETTE.guardAlert : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardEdge;
      context.lineWidth = 2;
      context.stroke();
      // Facing tick and a walking bob.
      const bob = guard.moving ? Math.sin(guard.stepPhase) * 1.5 : 0;
      context.fillStyle = PALETTE.guardEdge;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 9, guard.y + Math.sin(guard.angle) * 9 + bob * 0.2, 3.5, 0, Math.PI * 2);
      context.fill();
      if (guard.state === GUARD_SUSPICIOUS) text('?', guard.x, guard.y - 22, 22, PALETTE.guardSuspicious, 'center');
      else if (guard.state === GUARD_ALERT) text('!', guard.x, guard.y - 22, 24, PALETTE.guardAlert, 'center');
    }
    for (const camera of state.cameras) {
      context.fillStyle = '#8a93a3';
      context.fillRect(camera.x - 9, camera.y - 9, 18, 18);
      context.fillStyle = camera.suspicion > 0.5 ? PALETTE.guardAlert : '#d64545';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 7, camera.y + Math.sin(camera.angle) * 7, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.sneaking) {
      context.save();
      context.strokeStyle = 'rgba(184, 255, 246, 0.6)';
      context.setLineDash([4, 5]);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(player.x, player.y, 19, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.playerEdge;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.playerEdge;
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 7, player.y + Math.sin(player.angle) * 7, 3.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawThrown(state) {
    for (const coin of state.thrown) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      context.fill();
      if (coin.timer > 0) {
        context.strokeStyle = `rgba(242, 201, 76, ${Math.max(0, coin.timer / 0.4)})`;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(coin.x, coin.y, 12 + (0.4 - coin.timer) * 60, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function drawHud(state, best) {
    context.fillStyle = 'rgba(10, 12, 18, 0.78)';
    context.fillRect(0, 0, FIELD.width, 40);
    text(state.level.name.toUpperCase(), 16, 27, 15, PALETTE.text);
    plainText(`FILES ${state.filesTaken}/${state.files.length}`, 430, 27, 15, PALETTE.gold);
    let hearts = '';
    for (let i = 0; i < state.lives; i += 1) hearts += '♥ ';
    text(hearts, 560, 27, 16, '#ff6b81');
    plainText(`COINS ${state.coinsLeft}`, 700, 27, 15, PALETTE.muted);
    plainText(`SCORE ${state.score}`, 820, 27, 15, PALETTE.text);
    plainText(`TIME ${formatTime(state.levelTime)}`, 1000, 27, 15, PALETTE.text);
    plainText(`BEST ${best}`, 1140, 27, 15, PALETTE.muted);

    // The seen bar: how close the nearest guard is to raising the alarm.
    let worst = 0;
    let alert = false;
    for (const guard of state.guards) {
      worst = Math.max(worst, guard.suspicion);
      if (guard.state === GUARD_ALERT) alert = true;
    }
    for (const camera of state.cameras) worst = Math.max(worst, camera.suspicion);
    if (alert) {
      context.fillStyle = PALETTE.danger;
      text('ALARM — BREAK LINE OF SIGHT', FIELD.width / 2, 66, 16, PALETTE.danger, 'center');
    } else if (worst > 0.08) {
      const width = 220;
      const x = (FIELD.width - width) / 2;
      context.fillStyle = 'rgba(10, 12, 18, 0.78)';
      context.fillRect(x - 58, 48, width + 116, 26);
      plainText('SEEN', x - 48, 67, 14, worst > 0.45 ? PALETTE.guardSuspicious : PALETTE.muted);
      context.fillStyle = '#2a3040';
      context.fillRect(x, 54, width, 12);
      context.fillStyle = worst > 0.45 ? PALETTE.guardSuspicious : PALETTE.gold;
      context.fillRect(x, 54, width * Math.min(1, worst), 12);
    }

    const objective =
      state.filesTaken < state.files.length
        ? `Take ${state.files.length - state.filesTaken} more file${state.files.length - state.filesTaken === 1 ? '' : 's'}, then reach the green exit.`
        : 'All files taken — reach the green exit unseen.';
    plainText(objective, FIELD.width / 2, FIELD.height - 12, 14, PALETTE.muted, 'center');
  }

  function drawWorld(state, now, best) {
    drawFloor(state);
    drawLampGlow(state);
    drawWallsAndCover(state);
    drawLighting(state);
    drawExit(state, now);
    drawFiles(state, now);
    drawCones(state);
    drawThrown(state);
    drawGuards(state, now);
    drawPlayer(state);
    drawHud(state, best);
  }

  function drawTitle(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(6, 8, 12, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(290, 130, 700, 440);
    text('THE MERIDIAN ARCHIVE', 640, 200, 40, PALETTE.text, 'center');
    plainText('A stealth game in three floors', 640, 232, 18, PALETTE.muted, 'center');
    plainText('You are Wren, a courier with one night to take back', 640, 292, 17, PALETTE.text, 'center');
    plainText('three sealed files from the archive — and leave unseen.', 640, 318, 17, PALETTE.text, 'center');
    plainText(state.level.brief, 640, 362, 15, PALETTE.muted, 'center');
    plainText('WASD / arrows — move      Shift — sneak (slow, quiet, harder to see)', 640, 420, 15, PALETTE.text, 'center');
    plainText('Q or click — throw a coin to distract a guard      P — pause', 640, 448, 15, PALETTE.text, 'center');
    plainText('Hide behind shelves and crates. Plants hide you too. Light gives you away.', 640, 476, 15, PALETTE.text, 'center');
    text('Press Space or click to begin', 640, 528, 18, PALETTE.gold, 'center');
    if (best > 0) plainText(`Best score ${best}`, 640, 556, 14, PALETTE.muted, 'center');
  }

  function drawPaused(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(6, 8, 12, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(440, 250, 400, 180);
    text('PAUSED', 640, 320, 34, PALETTE.text, 'center');
    plainText('Press P or Space to keep sneaking', 640, 366, 16, PALETTE.muted, 'center');
  }

  function drawLevelDone(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(6, 8, 12, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(390, 220, 500, 240);
    text('FLOOR CLEAR', 640, 290, 34, PALETTE.text, 'center');
    plainText(`${state.level.name} — score ${state.score}`, 640, 330, 17, PALETTE.gold, 'center');
    plainText(state.ghost ? 'Never once raised the alarm. A ghost.' : `Raised the alarm ${state.detections} time${state.detections === 1 ? '' : 's'}.`, 640, 362, 15, PALETTE.muted, 'center');
    text('Press Space for the next floor', 640, 420, 17, PALETTE.gold, 'center');
  }

  function drawCaught(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(20, 4, 6, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(390, 220, 500, 240);
    text('CAUGHT', 640, 290, 34, PALETTE.danger, 'center');
    plainText(`A guard got you. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left — the floor resets.`, 640, 330, 16, PALETTE.text, 'center');
    plainText('Watch the patrols. Wait for the cone to turn away.', 640, 362, 15, PALETTE.muted, 'center');
    text('Press Space to try the floor again', 640, 420, 17, PALETTE.gold, 'center');
  }

  function drawOver(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(6, 8, 12, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(390, 220, 500, 240);
    text('THE ARCHIVE KEEPS ITS FILES', 640, 290, 26, PALETTE.danger, 'center');
    plainText(`Score ${state.score} — best ${Math.max(best, state.score)}`, 640, 332, 17, PALETTE.text, 'center');
    text('Press Space to start over', 640, 420, 17, PALETTE.gold, 'center');
  }

  function drawWin(state, best) {
    drawWorld(state, 0, best);
    context.fillStyle = 'rgba(6, 8, 12, 0.66)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 170, 600, 360);
    const rank = state.ghost ? 'GHOST' : state.detections <= 2 ? 'SHADOW' : 'SEEN';
    text('OUT UNSEEN', 640, 240, 40, PALETTE.exit, 'center');
    text(`RANK: ${rank}`, 640, 292, 26, PALETTE.gold, 'center');
    plainText(`All three floors, all nine files. Score ${state.score}.`, 640, 332, 17, PALETTE.text, 'center');
    plainText(`Alarms raised: ${state.detections} — best ${Math.max(best, state.score)}`, 640, 362, 15, PALETTE.muted, 'center');
    plainText('Wren slips into the night with the archive in her coat.', 640, 398, 15, PALETTE.muted, 'center');
    text('Press Space to play again', 640, 478, 17, PALETTE.gold, 'center');
  }

  return {
    resize,
    /** Window pixels to field pixels, for aiming a thrown coin. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale,
      };
    },
    draw(state, screen, best, now) {
      resize();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = PALETTE.backdrop;
      context.fillRect(0, 0, view.width, view.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused(state, best);
      else if (screen === SCREEN_LEVEL) drawLevelDone(state, best);
      else if (screen === SCREEN_CAUGHT) drawCaught(state, best);
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
      else drawWorld(state, now, best);
    },
  };
}
