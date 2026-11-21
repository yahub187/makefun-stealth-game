// The Meridian Archive — the entry program for a stealth game.
//
// The game itself lives in game/ as plain static files: a top-down 2D stealth game in
// three floors of a night archive, with guards who patrol on fixed routes and watch
// through vision cones, cameras that sweep the halls, shelves and crates and plants to
// hide behind, pools of lamplight that give you away, a suspicion system that lets you
// be noticed, chased and lost again, coins to throw as a distraction, and nine sealed
// files to take before you slip out the exit unseen — all vanilla JavaScript ES modules,
// no build step, no network requests, playable offline from game/index.html.
//
// This program is the hand-in plumbing (Node 22, standard library only): it copies
// game/ and screenshots/ from beside this file to the output folder and writes
// dossier.json there with the vendored make.fun library, exactly as the scorer expects.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_NAME = 'The Meridian Archive';
console.log(`${GAME_NAME}: handing in three floors of night archive — patrols to learn, cones to dodge, nine files to take, one exit unseen.`);

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`${GAME_NAME}: dossier written for the archive (game/ + screenshots/ copied to output).`);
