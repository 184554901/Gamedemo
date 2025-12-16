import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Entity, 
  EntityState, 
  Direction, 
  Particle, 
  Vector2, 
  HitBox 
} from '../types';
import { 
  PLAYER_ASSETS, 
  ENEMY_ASSETS, 
  GRAVITY, 
  GROUND_Y, 
  COLORS,
  PLAYER_SPEED,
  PLAYER_DODGE_SPEED,
  ENEMY_SPEED,
  ENEMY_DETECT_RANGE,
  ENEMY_ATTACK_RANGE,
  COOLDOWN_SKILL_1,
  COOLDOWN_SKILL_2,
  PLAYER_JUMP_FORCE
} from '../constants';

// --- HELPER FUNCTIONS ---

const checkCollision = (r1: {x: number, y: number, w: number, h: number}, r2: {x: number, y: number, w: number, h: number}) => {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
};

const createParticle = (x: number, y: number, type: Particle['type'], count = 1, options?: { speed?: number, size?: number, color?: string, life?: number }): Particle[] => {
  const particles: Particle[] = [];
  const baseSpeed = options?.speed || 4;
  const baseSize = options?.size || 4;
  
  for(let i=0; i<count; i++) {
    particles.push({
      id: Math.random().toString(36),
      pos: { x, y },
      velocity: { 
        x: (Math.random() - 0.5) * baseSpeed * 2, 
        y: (Math.random() - 0.5) * baseSpeed * 2 
      },
      life: options?.life || 1.0,
      maxLife: options?.life || 1.0,
      size: Math.random() * baseSize + 2,
      color: options?.color || (type === 'blood' ? COLORS.blood : type === 'energy' ? COLORS.gold : COLORS.ink),
      type
    });
  }
  return particles;
};

// --- COMPONENT ---

export const InkCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Image Cache System
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  // Game State
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [playerHp, setPlayerHp] = useState(5); 
  const [bossHp, setBossHp] = useState(100); // Boss HP for UI
  const [maxBossHp, setMaxBossHp] = useState(100);
  const [hurtFlash, setHurtFlash] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  // Input Visual State
  const [inputState, setInputState] = useState({ 
    attack: false, 
    heavy: false, 
    skill1: false, 
    skill2: false, 
    dodgeLeft: false,
    dodgeRight: false,
    jump: false,
    left: false,
    right: false
  });

  // Mutable Game State
  const gameState = useRef({
    player: {
      id: 'player',
      type: 'player',
      pos: { x: 200, y: GROUND_Y }, 
      velocity: { x: 0, y: 0 },
      width: 50,
      height: 100,
      state: EntityState.IDLE,
      direction: Direction.RIGHT,
      health: 5, 
      maxHealth: 5, 
      isInvulnerable: false,
      hitTimer: 0,
      animFrameIndex: 0,
      animTimer: 0,
      attackCooldownTimer: 0,
      skill1Cooldown: 0,
      skill2Cooldown: 0,
      attackActiveFrameStart: 0,
      attackActiveFrameEnd: 0,
    } as Entity,
    enemies: [] as Entity[],
    particles: [] as Particle[],
    camera: { x: 0 },
    keys: {
      left: false, right: false, j: false, k: false, l: false, semicolon: false, q: false, e: false, w: false 
    },
    hitStop: 0,
    frameCount: 0,
    invulnerabilityTimer: 0,
    shake: 0 // Screen shake magnitude
  });

  // --- GAME RESET LOGIC (BOSS SCENE) ---
  const resetGame = useCallback(() => {
    // Reset Player
    const p = gameState.current.player;
    p.health = 5;
    p.state = EntityState.IDLE;
    p.pos.x = 150; // Start Left
    p.pos.y = GROUND_Y - p.height;
    p.velocity = { x: 0, y: 0 };
    p.isInvulnerable = false;
    p.hitTimer = 0;
    p.animFrameIndex = 0;
    p.skill1Cooldown = 0;
    p.skill2Cooldown = 0;
    
    // Reset World
    gameState.current.camera.x = 0; // Fixed Camera
    gameState.current.particles = [];
    gameState.current.frameCount = 0;
    gameState.current.hitStop = 0;
    gameState.current.shake = 0;
    
    // Spawn THE BOSS
    const BOSS_HP = 2000;
    const boss: Entity = {
      id: 'the_general',
      type: 'enemy',
      subtype: 'boss',
      pos: { x: 800, y: GROUND_Y - 180 }, // Start Right, Taller
      velocity: { x: 0, y: 0 },
      width: 140, // Wider
      height: 180, // Taller
      state: EntityState.IDLE,
      direction: Direction.LEFT,
      health: BOSS_HP,
      maxHealth: BOSS_HP,
      isInvulnerable: false,
      hitTimer: 0,
      animFrameIndex: 0,
      animTimer: 0,
      attackCooldownTimer: 90, // Initial delay
      skill1Cooldown: 0,
      skill2Cooldown: 0,
      attackActiveFrameStart: 0,
      attackActiveFrameEnd: 0
    };

    gameState.current.enemies = [boss];

    // Reset UI
    setPlayerHp(5);
    setBossHp(BOSS_HP);
    setMaxBossHp(BOSS_HP);
    setGameOver(false);
    setGameWon(false);
  }, []);

  // --- ORIENTATION CHECK ---
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
        window.removeEventListener('resize', checkOrientation);
        window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // --- LOGIC HELPERS ---
  const triggerJump = useCallback(() => {
     if (gameState.current.player.state === EntityState.DEAD) return;
     const p = gameState.current.player;
     if (Math.abs(p.pos.y - (GROUND_Y - p.height)) < 5) {
         p.velocity.y = PLAYER_JUMP_FORCE;
         gameState.current.particles.push(...createParticle(p.pos.x + p.width/2, GROUND_Y, 'ink', 3));
         setInputState(prev => ({...prev, jump: true}));
         setTimeout(() => setInputState(prev => ({...prev, jump: false})), 100);
     }
  }, []);

  const handleAction = useCallback((actionType: string) => {
    const p = gameState.current.player;
    // Standard cancel rules: Can only cancel Idle/Run
    const canInterrupt = p.state === EntityState.IDLE || p.state === EntityState.RUN;
    
    if (!canInterrupt) return;
    
    // Set State
    switch (actionType) {
      case 'ATTACK': // J
        p.state = EntityState.ATTACK;
        p.animFrameIndex = 0;
        p.velocity.x = 0;
        p.attackActiveFrameStart = 2;
        p.attackActiveFrameEnd = 4;
        break;
      case 'ATTACK_HEAVY': // K
        p.state = EntityState.ATTACK_HEAVY;
        p.animFrameIndex = 0;
        p.velocity.x = 0;
        p.attackActiveFrameStart = 4;
        p.attackActiveFrameEnd = 6;
        break;
      case 'SKILL_1': // L
        if (p.skill1Cooldown > 0) return;
        p.state = EntityState.SKILL_1;
        p.animFrameIndex = 0;
        p.velocity.x = p.direction * 15;
        p.skill1Cooldown = COOLDOWN_SKILL_1;
        p.attackActiveFrameStart = 2;
        p.attackActiveFrameEnd = 6;
        break;
      case 'SKILL_2': // ;
        if (p.skill2Cooldown > 0) return;
        p.state = EntityState.SKILL_2;
        p.animFrameIndex = 0;
        p.velocity.x = 0;
        p.skill2Cooldown = COOLDOWN_SKILL_2;
        p.attackActiveFrameStart = 3;
        p.attackActiveFrameEnd = 5;
        gameState.current.particles.push(...createParticle(p.pos.x + p.width/2, p.pos.y + p.height, 'energy', 20));
        break;
      case 'DODGE_LEFT': // Q
        p.state = EntityState.DODGE;
        p.animFrameIndex = 0;
        p.velocity.x = -1 * PLAYER_DODGE_SPEED;
        p.direction = Direction.LEFT;
        break;
      case 'DODGE_RIGHT': // E
        p.state = EntityState.DODGE;
        p.animFrameIndex = 0;
        p.velocity.x = 1 * PLAYER_DODGE_SPEED;
        p.direction = Direction.RIGHT;
        break;
    }
  }, []);

  const triggerSmartDodge = useCallback(() => {
    if (gameState.current.player.state === EntityState.DEAD) return;
    const keys = gameState.current.keys;
    const p = gameState.current.player;
    let dodgeDir = 'DODGE_RIGHT';
    if (keys.left) dodgeDir = 'DODGE_LEFT';
    else if (keys.right) dodgeDir = 'DODGE_RIGHT';
    else dodgeDir = p.direction === Direction.RIGHT ? 'DODGE_LEFT' : 'DODGE_RIGHT';
    
    if (dodgeDir === 'DODGE_LEFT') {
        setInputState(prev => ({...prev, dodgeLeft: true}));
        setTimeout(() => setInputState(prev => ({...prev, dodgeLeft: false})), 100);
    } else {
        setInputState(prev => ({...prev, dodgeRight: true}));
        setTimeout(() => setInputState(prev => ({...prev, dodgeRight: false})), 100);
    }
    handleAction(dodgeDir);
  }, [handleAction]);

  // --- INPUT HANDLING ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (gameState.current.player.state === EntityState.DEAD) return;
      const keys = gameState.current.keys;
      switch(e.key.toLowerCase()) {
        case 'a': case 'arrowleft': keys.left = true; setInputState(p=>({...p, left: true})); break;
        case 'd': case 'arrowright': keys.right = true; setInputState(p=>({...p, right: true})); break;
        case 'w': case 'arrowup': triggerJump(); break;
        case 'j': keys.j = true; setInputState(p => ({...p, attack: true})); handleAction('ATTACK'); break;
        case 'k': keys.k = true; setInputState(p => ({...p, heavy: true})); handleAction('ATTACK_HEAVY'); break;
        case 'l': keys.l = true; setInputState(p => ({...p, skill1: true})); handleAction('SKILL_1'); break;
        case ';': keys.semicolon = true; setInputState(p => ({...p, skill2: true})); handleAction('SKILL_2'); break;
        case 'q': keys.q = true; setInputState(p => ({...p, dodgeLeft: true})); handleAction('DODGE_LEFT'); break;
        case 'e': keys.e = true; setInputState(p => ({...p, dodgeRight: true})); handleAction('DODGE_RIGHT'); break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = gameState.current.keys;
      switch(e.key.toLowerCase()) {
        case 'a': case 'arrowleft': keys.left = false; setInputState(p=>({...p, left: false})); break;
        case 'd': case 'arrowright': keys.right = false; setInputState(p=>({...p, right: false})); break;
        case 'j': keys.j = false; setInputState(p => ({...p, attack: false})); break;
        case 'k': keys.k = false; setInputState(p => ({...p, heavy: false})); break;
        case 'l': keys.l = false; setInputState(p => ({...p, skill1: false})); break;
        case ';': keys.semicolon = false; setInputState(p => ({...p, skill2: false})); break;
        case 'q': keys.q = false; setInputState(p => ({...p, dodgeLeft: false})); break;
        case 'e': keys.e = false; setInputState(p => ({...p, dodgeRight: false})); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameOver, triggerJump, handleAction]);

  // --- GAME LOOP ---
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      if (!gameWon && window.innerWidth > window.innerHeight) {
         update();
      }
      render(); 
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameOver, gameWon]);

  // --- UPDATE LOGIC ---
  const update = () => {
    const state = gameState.current;

    // Shake decay
    if (state.shake > 0) state.shake *= 0.9;
    if (state.shake < 0.5) state.shake = 0;

    // Hit Stop
    if (state.hitStop > 0) {
      state.hitStop--;
      return;
    }

    state.frameCount++;
    if (state.invulnerabilityTimer > 0) state.invulnerabilityTimer--;

    const p = state.player;

    // Cooldowns
    if (p.skill1Cooldown > 0) p.skill1Cooldown--;
    if (p.skill2Cooldown > 0) p.skill2Cooldown--;

    // --- PLAYER DEATH CHECK ---
    if (p.health <= 0 && p.state !== EntityState.DEAD) {
        p.state = EntityState.DEAD;
        p.velocity.x = 0;
        p.velocity.y = 0;
        
        // Death Explosion
        state.particles.push(...createParticle(p.pos.x + p.width/2, p.pos.y + p.height/2, 'ink', 40, { speed: 6, size: 6 }));
        state.particles.push(...createParticle(p.pos.x + p.width/2, p.pos.y + p.height/2, 'blood', 15, { speed: 3, size: 4 }));
        
        // Soul rising
        state.particles.push({
           id: 'soul', pos: {x: p.pos.x + p.width/2, y: p.pos.y + p.height}, velocity: {x: 0, y: -1},
           life: 1, maxLife: 1, size: 8, color: '#fff', type: 'energy'
        });
        
        setPlayerHp(0); 
        setGameOver(true);
    }

    // --- PLAYER PHYSICS ---
    if (p.state !== EntityState.DEAD) {
        p.velocity.y += GRAVITY;
        p.pos.y += p.velocity.y;
        if (p.pos.y > GROUND_Y - p.height) {
            p.pos.y = GROUND_Y - p.height;
            p.velocity.y = 0;
        }

        if (p.state === EntityState.IDLE || p.state === EntityState.RUN) {
            if (state.keys.left) {
                p.velocity.x = -PLAYER_SPEED;
                p.direction = Direction.LEFT;
                p.state = EntityState.RUN;
            } else if (state.keys.right) {
                p.velocity.x = PLAYER_SPEED;
                p.direction = Direction.RIGHT;
                p.state = EntityState.RUN;
            } else {
                p.velocity.x = 0;
                p.state = EntityState.IDLE;
            }
        } else if (p.state === EntityState.DODGE) {
            p.velocity.x *= 0.9;
        } else if (p.state === EntityState.SKILL_1) {
            p.velocity.x *= 0.85;
        } else if (p.state === EntityState.HURT) {
            p.velocity.x *= 0.95;
        } else if (p.state === EntityState.ATTACK || p.state === EntityState.ATTACK_HEAVY) {
            p.velocity.x = 0; // Root during attack
        }

        // Keep player in arena (Fixed Stage)
        const arenaWidth = 1024;
        p.pos.x = Math.max(0, Math.min(arenaWidth - p.width, p.pos.x + p.velocity.x));
    }

    // --- PLAYER ANIMATION TICK ---
    const pAssets = PLAYER_ASSETS[p.state];
    // Use asset frame count if available, else fallback
    const pMaxFrames = pAssets.src.length > 0 ? pAssets.src.length : (p.state === EntityState.SKILL_2 ? 12 : 8);
    const pFrameDuration = 60 / pAssets.frameRate;

    p.animTimer++;
    if (p.animTimer >= pFrameDuration) {
        p.animTimer = 0;
        p.animFrameIndex++;
        
        if (p.animFrameIndex >= pMaxFrames) {
            if (pAssets.loop) {
                p.animFrameIndex = 0;
            } else {
                // Return to idle if animation finishes and it's not looping
                p.state = EntityState.IDLE;
                p.animFrameIndex = 0;
            }
        }
    }

    // --- HIT DETECTION (EVERY FRAME) ---
    // Moved outside of the animation frame tick to ensure responsive hit registration
    const isAttackState = [EntityState.ATTACK, EntityState.ATTACK_HEAVY, EntityState.SKILL_1, EntityState.SKILL_2].includes(p.state);
    if (isAttackState && p.animFrameIndex >= p.attackActiveFrameStart && p.animFrameIndex <= p.attackActiveFrameEnd) {
             let damage = 60; // Increased base damage
             let range = 100;
             let particleType: Particle['type'] = 'blood';

             if(p.state === EntityState.ATTACK_HEAVY) { damage = 120; range = 130; }
             if(p.state === EntityState.SKILL_1) { damage = 90; range = 150; }
             if(p.state === EntityState.SKILL_2) { damage = 200; range = 300; particleType = 'energy'; }

             const attackBox = {
               x: p.direction === Direction.RIGHT ? p.pos.x + p.width : p.pos.x - range + p.width,
               y: p.pos.y - 20,
               w: range, h: p.height + 40
             };
             if (p.state === EntityState.SKILL_2) {
               attackBox.x = p.pos.x + p.width/2 - range/2;
               attackBox.w = range;
             }

             state.enemies.forEach(e => {
               if (e.state !== EntityState.DEAD && checkCollision(attackBox, {x: e.pos.x, y: e.pos.y, w: e.width, h: e.height})) {
                 if (e.hitTimer <= 0) {
                    e.health -= damage;
                    e.hitTimer = 20; // Prevents multi-hit on same attack
                    setBossHp(Math.max(0, e.health)); // SYNC BOSS HP
                    state.particles.push(...createParticle(e.pos.x + e.width/2, e.pos.y + 100, particleType, 8));
                    state.hitStop = 4;
                    // BOSS HAS SUPER ARMOR: Do not set state to HURT, but visual spark
                    state.particles.push(...createParticle(e.pos.x + e.width/2, e.pos.y + 50, 'spark', 5));
                 }
               }
             });
    }

    // --- BOSS AI LOGIC ---
    state.enemies.forEach(boss => {
       if (boss.state === EntityState.DEAD) return;

       // CRITICAL FIX: Update Boss Hit Timer so it becomes vulnerable again
       if (boss.hitTimer > 0) boss.hitTimer--;

       // Boss Death
       if (boss.health <= 0) {
           boss.state = EntityState.DEAD;
           setGameWon(true);
           state.hitStop = 60; // Long dramatic pause
           state.shake = 20;
           return;
       }

       // Gravity
       boss.velocity.y += GRAVITY;
       boss.pos.y += boss.velocity.y;
       if (boss.pos.y > GROUND_Y - boss.height) {
           boss.pos.y = GROUND_Y - boss.height;
           boss.velocity.y = 0;
       }
       
       // Face Player
       if (boss.state === EntityState.IDLE || boss.state === EntityState.RUN) {
           boss.direction = p.pos.x < boss.pos.x ? Direction.LEFT : Direction.RIGHT;
       }

       // AI State Machine
       if (boss.state === EntityState.IDLE) {
           boss.attackCooldownTimer--;
           if (boss.attackCooldownTimer <= 0) {
               // Decision Phase
               const dist = Math.abs(p.pos.x - boss.pos.x);
               const rand = Math.random();

               if (dist > 500) {
                   // Too far: Dash or Walk
                   if (rand > 0.5) {
                       // SKILL 1: Phantom Dash
                       boss.state = EntityState.SKILL_1; // Dash
                       boss.animFrameIndex = 0;
                       boss.attackActiveFrameStart = 10; 
                       boss.attackActiveFrameEnd = 20;   
                       state.particles.push(...createParticle(boss.pos.x, boss.pos.y+100, 'ink', 20));
                   } else {
                       boss.state = EntityState.RUN;
                       boss.attackCooldownTimer = 60; // Walk for 1s
                   }
               } else if (dist < 200) {
                   // Close: Cleave or Smash
                   if (rand > 0.6) {
                       // HEAVY: Earthshaker (Jump Slam)
                       boss.state = EntityState.ATTACK_HEAVY;
                       boss.animFrameIndex = 0;
                       boss.attackActiveFrameStart = 20; 
                       boss.attackActiveFrameEnd = 24; 
                       boss.velocity.y = -12; // JUMP!
                   } else {
                       // LIGHT: Cleave
                       boss.state = EntityState.ATTACK;
                       boss.animFrameIndex = 0;
                       boss.attackActiveFrameStart = 15; 
                       boss.attackActiveFrameEnd = 20;
                   }
               } else {
                   // Mid Range: Walk closer
                   boss.state = EntityState.RUN;
                   boss.attackCooldownTimer = 30;
               }

               // Randomly trigger Skill 2 (Ink Storm) regardless of distance
               if (rand < 0.15 && boss.state === EntityState.IDLE) {
                   boss.state = EntityState.SKILL_2;
                   boss.animFrameIndex = 0;
                   boss.attackActiveFrameStart = 15; 
                   boss.attackActiveFrameEnd = 25;
               }
           }
       } else if (boss.state === EntityState.RUN) {
           boss.velocity.x = boss.direction * (ENEMY_SPEED * 1.5);
           boss.pos.x += boss.velocity.x;
           boss.attackCooldownTimer--;
           if (boss.attackCooldownTimer <= 0) {
               boss.state = EntityState.IDLE;
               boss.velocity.x = 0;
               boss.attackCooldownTimer = 10; // Brief pause before next thought
           }
       }

       // Boss Animation & Hitboxes
       const bAssets = ENEMY_ASSETS[boss.state];
       boss.animTimer++;
       let bFrameRate = bAssets.frameRate || 10;
       
       // Fallback frames if asset not present
       let bMaxFrames = bAssets.src.length > 0 ? bAssets.src.length : 30; 
       
       // Override max frames if using procedural fallback (same as before)
       if (bAssets.src.length === 0) {
           if (boss.state === EntityState.ATTACK) { bFrameRate = 12; bMaxFrames = 30; } 
           if (boss.state === EntityState.ATTACK_HEAVY) { bFrameRate = 10; bMaxFrames = 40; } 
           if (boss.state === EntityState.SKILL_1) { bFrameRate = 15; bMaxFrames = 30; } 
           if (boss.state === EntityState.SKILL_2) { bFrameRate = 12; bMaxFrames = 40; } 
       }

       if (boss.animTimer >= 60/bFrameRate) {
           boss.animTimer = 0;
           boss.animFrameIndex++;

           // --- BOSS ATTACK EXECUTION ---
           if (boss.animFrameIndex === boss.attackActiveFrameStart - 5) { 
               state.particles.push(...createParticle(boss.pos.x + boss.width/2, boss.pos.y + 50, 'blood', 5, { speed: 8, size: 5 }));
           }
           
           if (boss.animFrameIndex === boss.attackActiveFrameStart) {
               if (boss.state === EntityState.ATTACK_HEAVY) {
                   state.shake = 15; 
                   state.particles.push(...createParticle(boss.pos.x + boss.width/2, GROUND_Y, 'ink', 30, { speed: 10, size: 8 }));
               } else if (boss.state === EntityState.ATTACK) {
                   state.shake = 5;
               } else if (boss.state === EntityState.SKILL_2) {
                   state.shake = 8;
                   for(let i=0; i<10; i++) {
                       const offX = (Math.random() - 0.5) * 800;
                       state.particles.push({
                           id: Math.random().toString(),
                           pos: { x: boss.pos.x + offX, y: GROUND_Y },
                           velocity: { x: 0, y: -5 - Math.random()*5 },
                           life: 1.0, maxLife: 1.0, size: 10, color: COLORS.ink, type: 'ink'
                       });
                   }
               }
           }

           // Active Frames
           if (boss.animFrameIndex >= boss.attackActiveFrameStart && boss.animFrameIndex <= boss.attackActiveFrameEnd) {
               let range = 0; 
               let damage = 1;
               let knockback = 0;
               let hitAllGround = false;

               if (boss.state === EntityState.ATTACK) {
                   range = 250; damage = 1; knockback = 20;
                   boss.velocity.x = boss.direction * 5; 
               } else if (boss.state === EntityState.ATTACK_HEAVY) {
                   range = 300; damage = 2; knockback = 30;
                   hitAllGround = false; 
               } else if (boss.state === EntityState.SKILL_1) {
                   range = 100; damage = 1; knockback = 15;
                   boss.velocity.x = boss.direction * 25; 
               } else if (boss.state === EntityState.SKILL_2) {
                   range = 600; damage = 1; knockback = 5; 
               }

               const attackBox = {
                   x: boss.direction === Direction.RIGHT ? boss.pos.x : boss.pos.x - range + boss.width,
                   y: boss.pos.y - 50,
                   w: range,
                   h: boss.height + 50
               };
               if (boss.state === EntityState.SKILL_2) {
                   attackBox.x = boss.pos.x + boss.width/2 - range/2;
               }

               if (p.state !== EntityState.DODGE && p.state !== EntityState.DEAD && state.invulnerabilityTimer <= 0) {
                   if (checkCollision(attackBox, {x: p.pos.x, y: p.pos.y, w: p.width, h: p.height})) {
                       p.state = EntityState.HURT;
                       p.health = Math.max(0, p.health - damage);
                       setPlayerHp(p.health);
                       setHurtFlash(true);
                       setTimeout(() => setHurtFlash(false), 200);
                       p.velocity.x = boss.direction * knockback;
                       p.velocity.y = -10;
                       state.invulnerabilityTimer = 120; 
                       state.hitStop = 10;
                       state.shake += 10;
                       state.particles.push(...createParticle(p.pos.x + p.width/2, p.pos.y, 'blood', 20));
                   }
               }
           }

           // End Animation
           if (boss.animFrameIndex >= bMaxFrames) {
               if (bAssets.loop) {
                   boss.animFrameIndex = 0;
               } else {
                   boss.state = EntityState.IDLE;
                   boss.animFrameIndex = 0;
                   boss.attackCooldownTimer = 80; 
               }
           }
       }
    });

    // --- PARTICLES ---
    for(let i = state.particles.length - 1; i >= 0; i--) {
      const part = state.particles[i];
      if (part.id === 'soul') continue; 
      
      part.pos.x += part.velocity.x;
      part.pos.y += part.velocity.y;
      part.velocity.y += 0.1;
      part.life -= 0.02;
      if (part.life <= 0) state.particles.splice(i, 1);
    }
  };


  // --- RENDER LOGIC ---
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = gameState.current;

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // CAMERA SHAKE
    const shakeX = (Math.random() - 0.5) * state.shake;
    const shakeY = (Math.random() - 0.5) * state.shake;
    ctx.translate(shakeX, shakeY);
    
    // Draw Ground
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(1024, GROUND_Y);
    ctx.stroke();

    // Arena Details
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.moveTo(200, GROUND_Y); ctx.lineTo(300, 300); ctx.lineTo(400, GROUND_Y);
    ctx.fill(); 

    // Helper: Draw Procedural Entity (Fallback)
    const drawProceduralEntity = (e: Entity) => {
        const w = e.width;
        const h = e.height;
  
        // VISUAL FEEDBACK ON HIT: FLASH
        let fillStyle = e.type === 'player' ? COLORS.ink : '#000';
        if (e.type === 'enemy' && e.hitTimer > 0) {
           fillStyle = '#888'; // Flash Grey/White on hit
        }
        if (e.state === EntityState.HURT) fillStyle = COLORS.blood;
        if (e.state === EntityState.DODGE) ctx.globalAlpha = 0.5;
  
        ctx.fillStyle = fillStyle;
  
        ctx.beginPath();
        if (e.type === 'player') {
            // PLAYER DRAWING
            ctx.moveTo(w*0.2, h); ctx.lineTo(w*0.8, h); ctx.lineTo(w*0.7, h*0.3); ctx.lineTo(w*0.3, h*0.3); ctx.fill();
            ctx.beginPath(); ctx.arc(w*0.5, h*0.2, 12, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = COLORS.blood; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(w*0.5, h*0.25); ctx.quadraticCurveTo(w*1.5, h*0.3, w + Math.sin(state.frameCount*0.1)*20, h*0.4); ctx.stroke();
            
            // Player Attack Visuals
             const isAttack = [EntityState.ATTACK, EntityState.ATTACK_HEAVY, EntityState.SKILL_1, EntityState.SKILL_2].includes(e.state);
             if (isAttack) {
               ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
               if (e.state === EntityState.ATTACK) {
                  const angle = -Math.PI/2 + (e.animFrameIndex / 4) * Math.PI;
                  ctx.beginPath(); ctx.moveTo(w*0.5, h*0.4); ctx.lineTo(w*0.5 + Math.cos(angle)*80, h*0.4 + Math.sin(angle)*80); ctx.stroke();
               } else if (e.state === EntityState.SKILL_1) {
                  ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w*0.5, h*0.5); ctx.lineTo(w + 100, h*0.5); ctx.stroke();
               }
             }
  
        } else {
            // BOSS DRAWING
            ctx.beginPath();
            ctx.moveTo(w*0.5, h); // Bottom Center
            ctx.lineTo(w, h*0.7); // Bottom Right
            ctx.lineTo(w*0.9, h*0.2); // Shoulder Right
            ctx.lineTo(w*0.5, -20); // Head Top (Tall)
            ctx.lineTo(w*0.1, h*0.2); // Shoulder Left
            ctx.lineTo(0, h*0.7); // Bottom Left
            ctx.closePath();
            ctx.fill();
  
            // Glowing Eyes
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(w*0.4, h*0.2, 4, 0, Math.PI*2);
            ctx.arc(w*0.6, h*0.2, 4, 0, Math.PI*2);
            ctx.fill();
            
            // Ornament
            ctx.strokeStyle = COLORS.gold;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(w*0.5, -20);
            ctx.lineTo(w*0.5, h*0.2);
            ctx.stroke();
  
            // BOSS ATTACK VISUALS
            if (e.state === EntityState.ATTACK_HEAVY) {
                if (e.animFrameIndex < e.attackActiveFrameStart) {
                    ctx.strokeStyle = COLORS.blood;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(w*0.5, h*0.5, w*0.8 + Math.random()*10, 0, Math.PI*2);
                    ctx.stroke();
                }
            } else if (e.state === EntityState.ATTACK) {
                if (e.animFrameIndex >= e.attackActiveFrameStart) {
                    ctx.strokeStyle = COLORS.ink;
                    ctx.lineWidth = 8;
                    ctx.beginPath();
                    ctx.arc(w*0.5, h*0.5, 200, -Math.PI/2, Math.PI/2);
                    ctx.stroke();
                }
            }
        }
    }

    // Helper: Draw Entity Logic (Images or Fallback)
    const drawEntity = (e: Entity) => {
      if (e.type === 'player' && state.invulnerabilityTimer > 0 && Math.floor(state.frameCount / 4) % 2 === 0) return;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.ellipse(e.pos.x + e.width/2, GROUND_Y - 5, e.width/2, 10, 0, 0, Math.PI*2); 
      ctx.fill();

      ctx.save();
      // Handle direction mirroring
      if (e.direction === Direction.LEFT) {
        ctx.translate(e.pos.x + e.width, e.pos.y);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(e.pos.x, e.pos.y);
      }
      
      // DEATH ANIMATION: FALLING DOWN (Rotation)
      if (e.type === 'player' && e.state === EntityState.DEAD) {
          ctx.translate(e.width/2, e.height);
          ctx.rotate(-Math.PI/2); 
          ctx.translate(-e.width/2, -e.height + 15); 
      }

      // --- IMAGE RENDERING LOGIC ---
      const assets = e.type === 'player' ? PLAYER_ASSETS : ENEMY_ASSETS;
      const config = assets[e.state];
      let imageDrawn = false;

      if (config && config.src.length > 0) {
        // Clamp frame index
        const frameIndex = e.animFrameIndex % config.src.length;
        const src = config.src[frameIndex];
        
        // Check Cache
        if (imageCache.current[src]) {
            const img = imageCache.current[src];
            if (img.complete && img.naturalHeight !== 0) {
                // Draw Image centered on entity box, but allow it to be larger than hitbox
                // Simple assumption: Image is roughly 1.5x larger than hitbox for effects
                const scale = 1.0; 
                // We draw the image to fill the hitbox width, maintaining aspect ratio? 
                // Better: Draw relative to hitbox bottom center.
                // For this demo, let's stretch to fit or centered draw.
                // Let's draw centered on width, aligned to bottom.
                
                // Adjust drawing dimensions based on image native ratio vs hitbox
                // But for now, just draw at entity size for simplicity, or slightly larger.
                const drawW = e.width * 1.5;
                const drawH = e.height * 1.5;
                const offX = -(drawW - e.width) / 2;
                const offY = -(drawH - e.height);
                
                ctx.drawImage(img, offX, offY, drawW, drawH);
                imageDrawn = true;
            }
        } else {
            // Load Image
            const img = new Image();
            img.src = src;
            imageCache.current[src] = img;
            // Won't draw this frame, will draw next frame when loaded
        }
      }

      if (!imageDrawn) {
          drawProceduralEntity(e);
      }
      
      ctx.restore();
    };

    state.enemies.forEach(e => drawEntity(e));
    drawEntity(state.player);

    state.particles.forEach(p => {
       ctx.globalAlpha = p.life;
       ctx.fillStyle = p.color;
       ctx.beginPath();
       ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI*2);
       ctx.fill();
       ctx.globalAlpha = 1;
    });

    ctx.restore();
    
    // Vignette
    const gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height/2, canvas.width/2, canvas.height/2, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.4)'); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0, canvas.width, canvas.height);
  };

  const TouchBtn = ({ label, sub, active, onStart, className, style }: any) => (
    <div 
        className={`absolute rounded-full border-2 border-stone-600/50 backdrop-blur-sm flex items-center justify-center select-none transition-all active:scale-95 ${active ? 'bg-stone-400/50 scale-95' : 'bg-stone-200/20'} ${className}`}
        style={style}
        onTouchStart={(e) => { e.preventDefault(); onStart(true); }}
        onTouchEnd={(e) => { e.preventDefault(); onStart(false); }}
        onMouseDown={(e) => { e.preventDefault(); onStart(true); }} 
        onMouseUp={(e) => { e.preventDefault(); onStart(false); }}
        onMouseLeave={() => onStart(false)}
    >
       <div className="flex flex-col items-center">
         <span className="font-serif font-bold text-stone-900 pointer-events-none">{label}</span>
         {sub && <span className="text-[10px] text-stone-800 pointer-events-none">{sub}</span>}
       </div>
    </div>
  );

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#1a1a1a] flex justify-center items-center overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={1024} 
        height={600} 
        className="w-full h-full object-contain max-w-none"
      />

      {isPortrait && (
        <div className="fixed inset-0 bg-[#1a1a1a] z-50 flex flex-col items-center justify-center text-stone-400 p-8 text-center pointer-events-auto">
            <div className="w-16 h-24 border-2 border-stone-500 rounded-lg mb-8 animate-rotate flex items-center justify-center">
                <div className="w-1 h-1 bg-stone-500 rounded-full mt-auto mb-2"></div>
            </div>
            <h2 className="text-2xl font-serif text-stone-200 mb-2">请旋转设备</h2>
        </div>
      )}
      
      <div className={`absolute inset-0 bg-red-900/30 pointer-events-none transition-opacity duration-75 ${hurtFlash ? 'opacity-100' : 'opacity-0'}`} />

      {/* PLAYER HP */}
      <div className="absolute top-4 left-6 text-stone-800 ink-text pointer-events-none flex flex-col gap-1 z-10">
         <div className="flex gap-2">
            {[...Array(gameState.current.player.maxHealth)].map((_, i) => (
                <div key={i} className={`w-6 h-6 rotate-45 border-2 border-red-900 transition-all duration-300 flex items-center justify-center ${i < playerHp ? 'bg-red-800' : 'opacity-30'}`}></div>
            ))}
         </div>
      </div>

      {/* BOSS HP BAR */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-1/2 z-10 pointer-events-none">
          <div className="w-full h-1 bg-stone-600 mb-1"></div>
          <div className="w-full h-3 bg-stone-900 border border-stone-600 relative overflow-hidden">
             <div 
               className="h-full bg-red-800 transition-all duration-200 ease-out"
               style={{ width: `${(bossHp / maxBossHp) * 100}%` }}
             ></div>
          </div>
          <h3 className="text-center text-stone-500 font-serif text-xs mt-1 tracking-[0.3em]">THE GENERAL</h3>
      </div>

      {/* CONTROLS */}
      <div className="absolute bottom-8 left-8 w-48 h-32 z-20 flex gap-4 no-select">
          <TouchBtn label="←" active={inputState.left} onStart={(p: boolean) => { gameState.current.keys.left = p; setInputState(s=>({...s, left: p})); }} className="w-20 h-20 text-3xl" />
          <TouchBtn label="→" active={inputState.right} onStart={(p: boolean) => { gameState.current.keys.right = p; setInputState(s=>({...s, right: p})); }} className="w-20 h-20 text-3xl" />
      </div>

      <div className="absolute bottom-8 right-8 w-64 h-64 z-20 no-select">
          <TouchBtn label="攻" active={inputState.attack} onStart={(p: boolean) => { if(p) { setInputState(s=>({...s, attack: true})); handleAction('ATTACK'); } else setInputState(s=>({...s, attack: false})); }} className="w-24 h-24 text-4xl right-20 bottom-16 border-stone-800 bg-stone-300/30" />
          <TouchBtn label="跳" active={inputState.jump} onStart={(p: boolean) => { if(p) triggerJump(); }} className="w-16 h-16 text-xl right-24 bottom-44" />
          <TouchBtn label="重" active={inputState.heavy} onStart={(p: boolean) => { if(p) { setInputState(s=>({...s, heavy: true})); handleAction('ATTACK_HEAVY'); } else setInputState(s=>({...s, heavy: false})); }} className="w-16 h-16 text-xl right-0 bottom-24 bg-red-900/10 border-red-900/30" />
          <TouchBtn label="避" active={inputState.dodgeLeft || inputState.dodgeRight} onStart={(p: boolean) => { if(p) triggerSmartDodge(); }} className="w-16 h-16 text-xl right-24 bottom-0" />
          <TouchBtn label="技" active={inputState.skill1} onStart={(p: boolean) => { if(p) { setInputState(s=>({...s, skill1: true})); handleAction('SKILL_1'); } else setInputState(s=>({...s, skill1: false})); }} className="w-12 h-12 text-sm right-48 bottom-32 bg-yellow-900/10" />
          <TouchBtn label="绝" active={inputState.skill2} onStart={(p: boolean) => { if(p) { setInputState(s=>({...s, skill2: true})); handleAction('SKILL_2'); } else setInputState(s=>({...s, skill2: false})); }} className="w-12 h-12 text-sm right-0 bottom-44 bg-yellow-900/10" />
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-50 pointer-events-auto">
           <h2 className="text-6xl text-red-700 font-serif mb-4 tracking-[0.5em]">死</h2>
           <button onTouchEnd={resetGame} onClick={resetGame} className="mt-4 px-10 py-4 border-2 border-red-900 bg-red-950/30 text-red-100 font-serif tracking-widest text-2xl">重试 / RETRY</button>
        </div>
      )}

      {gameWon && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-black z-50 pointer-events-auto">
           <h2 className="text-6xl font-serif mb-4 tracking-widest text-stone-900">VICTORY</h2>
           <button onTouchEnd={resetGame} onClick={resetGame} className="mt-8 px-8 py-3 border-2 border-stone-800 hover:bg-stone-200 transition text-xl">AGAIN</button>
        </div>
      )}
    </div>
  );
};