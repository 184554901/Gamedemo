import { EntityAssets, EntityState } from './types';

// --- HELPER TO GENERATE PATHS ---
// This assumes you put images in a folder named 'assets' in your public directory.
// Example: /assets/player_idle_0.png
const genPaths = (char: 'player' | 'boss', action: string, count: number): string[] => {
  return Array.from({ length: count }, (_, i) => `/assets/${char}_${action}_${i}.png`);
};

// --- VISUAL & ASSET CONFIGURATION ---

export const PLAYER_ASSETS: EntityAssets = {
  // 待机 (4 frames): /assets/player_idle_0.png ~ player_idle_3.png
  [EntityState.IDLE]:         { src: genPaths('player', 'idle', 4), frameRate: 4, loop: true },
  
  // 跑步 (8 frames)
  [EntityState.RUN]:          { src: genPaths('player', 'run', 8), frameRate: 10, loop: true },
  
  // 普通攻击 (Light Attack - J) (5 frames)
  [EntityState.ATTACK]:       { src: genPaths('player', 'attack', 5), frameRate: 12, loop: false }, 
  
  // 重攻击 (Heavy Attack - K) (7 frames)
  [EntityState.ATTACK_HEAVY]: { src: genPaths('player', 'heavy', 7), frameRate: 10, loop: false }, 
  
  // 技能1 (Dash - L) (7 frames)
  [EntityState.SKILL_1]:      { src: genPaths('player', 'skill1', 7), frameRate: 15, loop: false }, 
  
  // 技能2 (Ultimate - ;) (12 frames)
  [EntityState.SKILL_2]:      { src: genPaths('player', 'skill2', 12), frameRate: 8, loop: false },  
  
  // 闪避 (4 frames)
  [EntityState.DODGE]:        { src: genPaths('player', 'dodge', 4), frameRate: 15, loop: false },
  
  // 受击 (3 frames)
  [EntityState.HURT]:         { src: genPaths('player', 'hurt', 3), frameRate: 10, loop: false },
  
  // 死亡 (1 frame - keep the last frame static)
  [EntityState.DEAD]:         { src: genPaths('player', 'dead', 1), frameRate: 1, loop: false },
};

export const ENEMY_ASSETS: EntityAssets = {
  // BOSS 待机
  [EntityState.IDLE]:         { src: genPaths('boss', 'idle', 6), frameRate: 6, loop: true },
  
  // BOSS 移动
  [EntityState.RUN]:          { src: genPaths('boss', 'walk', 8), frameRate: 6, loop: true },
  
  // BOSS 横扫 (Cleave)
  [EntityState.ATTACK]:       { src: genPaths('boss', 'cleave', 15), frameRate: 15, loop: false }, 
  
  // BOSS 碎地 (Smash)
  [EntityState.ATTACK_HEAVY]: { src: genPaths('boss', 'smash', 18), frameRate: 8, loop: false },
  
  // BOSS 突进 (Dash)
  [EntityState.SKILL_1]:      { src: genPaths('boss', 'dash', 10), frameRate: 10, loop: false },
  
  // BOSS 风暴 (Storm)
  [EntityState.SKILL_2]:      { src: genPaths('boss', 'storm', 20), frameRate: 10, loop: false },
  
  // BOSS 闪避 (Optional)
  [EntityState.DODGE]:        { src: [], frameRate: 1, loop: false },
  
  // BOSS 受击 (Optional - boss has super armor, but color flash is used)
  [EntityState.HURT]:         { src: genPaths('boss', 'hurt', 1), frameRate: 10, loop: false },
  
  // BOSS 死亡
  [EntityState.DEAD]:         { src: genPaths('boss', 'dead', 1), frameRate: 1, loop: false },
};

// --- GAMEPLAY BALANCE ---

export const GRAVITY = 0.8;
export const GROUND_Y = 500; // Y position of the floor

export const PLAYER_SPEED = 4;
export const PLAYER_DODGE_SPEED = 12;
export const PLAYER_JUMP_FORCE = -15; 
export const PLAYER_ATTACK_COOLDOWN = 30; 

// Cooldowns in frames (60fps)
export const COOLDOWN_SKILL_1 = 300; // 5 seconds
export const COOLDOWN_SKILL_2 = 900; // 15 seconds

export const ENEMY_SPEED = 2.4; 
export const ENEMY_DETECT_RANGE = 600;
export const ENEMY_ATTACK_RANGE = 50; 
export const ENEMY_ATTACK_WINDUP = 40; 

// Colors (Tailwind references for consistency, but used in Canvas)
export const COLORS = {
  bg: '#f5f5f0', // Warm rice paper
  ink: '#1c1c1c', // Deep ink black
  inkLight: '#4a4a4a', // Diluted ink
  blood: '#8a1c1c', // Dried blood red
  paper: '#e8e8e3',
  gold: '#d4af37', // For special skills
};