// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sneakSpeed: 88,
  /** Noise radius while walking; sneaking makes none. */
  noiseRadius: 95,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  suspiciousSpeed: 110,
  chaseSpeed: 168,
  /** How long a guard pauses at each patrol waypoint, in seconds. */
  waypointPause: 1.6,
  /** Vision cone: how far and how wide a guard sees. */
  viewRange: 250,
  viewHalfAngle: 0.52,
  /** Suspicion gained per second of clear sight, at point blank in the light. */
  spotRate: 1.15,
  /** Suspicion lost per second while the player is unseen. */
  calmRate: 0.22,
  /** Suspicion at which a guard stops and stares, then walks over to look. */
  suspiciousAt: 0.45,
  /** Seconds a chasing guard keeps hunting after losing sight before giving up. */
  huntMemory: 4,
  /** Seconds a guard searches the last seen spot before returning to patrol. */
  searchTime: 3,
  /** Catch distance: a chasing guard this close to the player ends the run's life. */
  catchDistance: 26,
};

export const CAMERA = {
  viewRange: 220,
  viewHalfAngle: 0.42,
  /** Degrees per second the camera sweeps. */
  sweepSpeed: 0.55,
  spotRate: 0.9,
};

/** A lit floor multiplies how fast a guard spots you; darkness hides you. */
export const LIGHT = { inLight: 1.6, inDark: 0.62 };

/** Sneaking multiplies how fast a guard spots you (and you make no noise). */
export const SNEAK_SPOT = 0.55;

/** How far a thrown coin flies and how far its clink carries. */
export const COIN = { range: 260, clinkRadius: 230, perLevel: 3 };

export const LIVES = 3;
export const FILES_PER_LEVEL = 3;
export const SCORE = { file: 250, level: 400, ghost: 500, timePar: 90 };

/** Seconds of play the time bonus is measured against, per level. */
export const TIME_PAR = [90, 120, 150];

export const PALETTE = {
  backdrop: '#0a0c12',
  floor: '#262b38',
  floorAlt: '#1f232e',
  carpet: '#3d2c33',
  carpetEdge: '#54383f',
  wall: '#12141d',
  wallTop: '#2c3040',
  shelf: '#4a3421',
  shelfEdge: '#6b4a2e',
  shelfBooks: '#7a5a3a',
  crate: '#5a4632',
  crateEdge: '#7d6547',
  plant: '#2f5d3a',
  plantEdge: '#4c8a58',
  lampGlow: 'rgba(255, 196, 110, 0.10)',
  lampCore: '#ffd28a',
  exit: '#39d98a',
  exitEdge: '#1f9d63',
  file: '#ffe9a8',
  fileEdge: '#d9a441',
  guard: '#3d5a80',
  guardEdge: '#9db8d9',
  guardAlert: '#d64545',
  guardSuspicious: '#e0a53c',
  cone: 'rgba(255, 226, 140, 0.20)',
  coneSuspicious: 'rgba(224, 165, 60, 0.30)',
  coneAlert: 'rgba(214, 69, 69, 0.34)',
  cameraCone: 'rgba(255, 120, 120, 0.16)',
  player: '#2ec4b6',
  playerEdge: '#b8fff6',
  text: '#eef1f5',
  muted: '#9aa1b2',
  dim: '#6b7280',
  danger: '#ff5d5d',
  gold: '#f2c94c',
  panel: 'rgba(10, 12, 18, 0.88)',
  panelEdge: '#3a4152',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-archive.best';
