export type Vector2 = { x: number; y: number };

export enum EntityState {
  IDLE = 'IDLE',
  RUN = 'RUN',
  ATTACK = 'ATTACK', // Light Attack
  ATTACK_HEAVY = 'ATTACK_HEAVY',
  SKILL_1 = 'SKILL_1',
  SKILL_2 = 'SKILL_2',
  DODGE = 'DODGE',
  HURT = 'HURT',
  DEAD = 'DEAD'
}

export enum Direction {
  LEFT = -1,
  RIGHT = 1
}

export interface HitBox {
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
}

export interface AssetConfig {
  src: string[]; // Array of URLs for animation frames
  frameRate: number; // Frames per second
  loop: boolean;
}

export interface EntityAssets {
  [EntityState.IDLE]: AssetConfig;
  [EntityState.RUN]: AssetConfig;
  [EntityState.ATTACK]: AssetConfig;
  [EntityState.ATTACK_HEAVY]: AssetConfig;
  [EntityState.SKILL_1]: AssetConfig;
  [EntityState.SKILL_2]: AssetConfig;
  [EntityState.DODGE]: AssetConfig;
  [EntityState.HURT]: AssetConfig;
  [EntityState.DEAD]: AssetConfig;
}

export interface Entity {
  id: string;
  type: 'player' | 'enemy';
  subtype?: 'grunt' | 'heavy' | 'boss'; // Added subtype
  pos: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  state: EntityState;
  direction: Direction;
  health: number;
  maxHealth: number;
  isInvulnerable: boolean;
  hitTimer: number; // Cooldown to prevent multi-hit from same attack frame window
  
  // Animation state
  animFrameIndex: number;
  animTimer: number;
  
  // Combat logic
  attackCooldownTimer: number;
  skill1Cooldown: number; // New
  skill2Cooldown: number; // New
  attackActiveFrameStart: number; // Frame index when damage triggers
  attackActiveFrameEnd: number;
}

export interface Particle {
  id: string;
  pos: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'ink' | 'blood' | 'spark' | 'energy';
}