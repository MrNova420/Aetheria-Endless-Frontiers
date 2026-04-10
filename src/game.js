/**
 * src/game.js  –  AETHERIA: Endless Frontiers  –  Main Entry Point
 *
 * Wires together every system, runs the RAF loop, manages game states.
 * States: LOADING → MAIN_MENU → PLANET_SURFACE → SHIP_ATMOSPHERE → SPACE_LOCAL → GALAXY_MAP
 */
import * as THREE from 'three';
import { EffectComposer }     from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }         from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }    from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }         from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass }           from 'three/addons/postprocessing/SMAAPass.js';

import { Galaxy }             from './galaxy.js';
import { PlanetGenerator, PlanetAtmosphere } from './planet.js';
import { TerrainManager }     from './terrain.js';
import { FloraManager }       from './flora.js';
import { CreatureManager, CREATURE_STATE } from './creatures.js';
import { MiningSystem }       from './mining.js';
import { Player }             from './player.js';
import { Ship, FlightMode }   from './ship.js';
import { SpaceScene }         from './space.js';
import { Inventory }          from './inventory.js';
import { CraftingSystem, TechTree }     from './crafting.js';
import { AudioManager }       from './audio.js';
import { GameHUD }             from './ui.js';
import { PhysicsWorld }       from './physics.js';
import { getAssets }           from './assets.js';
import { WeatherSystem }       from './weather.js';
import { ExtractorManager }   from './extractor.js';
import { QuestSystem, QUEST_DEFS } from './quests.js';
import { StatusEffectManager } from './status.js';
import { TECH_UPGRADES, PLAYER_CONFIG as _PCFG, BIOME_COLORS } from './config.js';

// ─── Game states ──────────────────────────────────────────────────────────────
const GS = {
  LOADING      : 'LOADING',
  MAIN_MENU    : 'MAIN_MENU',
  PLANET_SURFACE: 'PLANET_SURFACE',
  SHIP_ATM     : 'SHIP_ATM',
  SPACE_LOCAL  : 'SPACE_LOCAL',
  GALAXY_MAP   : 'GALAXY_MAP',
  PAUSED       : 'PAUSED',
  DEAD         : 'DEAD',
};

// ─── Game constants ───────────────────────────────────────────────────────────
const COMBAT_TICK_INTERVAL = 0.5;   // seconds between creature damage ticks
const SCAN_COOLDOWN_DURATION = 2.5; // seconds scanner recharge time
const AUTO_SAVE_INTERVAL = 60;      // seconds between automatic saves
const SCANNER_RANGE = 30;           // world-units radius for scanner detection

// ─── XP constants ─────────────────────────────────────────────────────────────
const XP_PER_MINE_ITEM       = 3;    // XP per resource unit mined
const XP_MINE_CYCLE_MULT     = 10;   // multiplier per full mine cycle
const XP_PER_KILL            = 35;   // XP for killing a creature
const XP_BASE                = 100;  // XP needed for level 1→2
const XP_GROWTH              = 1.35; // multiplicative level-up cost scaling
const ATTACK_RANGE           = 12;   // world-units – player weapon reach
const ATTACK_DAMAGE          = 25;   // base damage per right-click shot
const ATTACK_COOLDOWN        = 0.5;  // seconds between shots
const WARP_FUEL_COST         = 1;    // Warp Cells per inter-system jump
const WEATHER_SPEED_BLIZZARD = 0.45; // blizzard/sandstorm speed fraction
const WEATHER_SPEED_STORM    = 0.70; // storm speed fraction
const DEATH_PENALTY_DROP_RATE = 0.5; // fraction of inventory dropped on death
const CREATURE_LOOT_DROP_CHANCE = 0.55; // probability of loot drop on creature kill

class Game {
  constructor() {
    this.state        = GS.LOADING;
    this._prevState   = null;
    this._dt          = 0;
    this._clock       = new THREE.Clock();
    this._input       = this._makeInput();
    this._currentPlanet = null;
    this._currentSystem = null;
    this._loadProgress  = 0;
    this._saveData      = null;
    this._autoSaveTimer = 0;
    this._combatTimer   = 0;
    this._scanCooldown  = 0;
    this._attackCooldown = 0;
    this._weather       = null;
    this._extractor     = null;
    this._quests        = new QuestSystem();
    this._status        = new StatusEffectManager();
    // XP / leveling
    this._level    = 1;
    this._xp       = 0;
    this._xpToNext = XP_BASE;
  }

  // ─── Async init ─────────────────────────────────────────────────────────────
  async init() {
    this._setLoad(5, 'Setting up renderer…');
    this._setupRenderer();
    this._setLoad(15, 'Building scene…');
    this._setupScene();
    this._setLoad(25, 'Initialising UI…');
    this._hud = new GameHUD();
    this._hud.init();
    this._setLoad(35, 'Generating galaxy…');
    this._galaxy = new Galaxy(12345);
    this._setLoad(40, 'Loading asset manifest…');
    this._assets = getAssets();
    await this._assets.loadManifest();
    this._setLoad(50, 'Downloading game assets…');
    await this._assets.preloadAll((pct, msg) => {
      this._setLoad(50 + Math.floor(pct * 0.2), msg);
    });
    this._setLoad(70, 'Creating systems…');
    this._inventory    = new Inventory(48);
    this._crafting     = new CraftingSystem(this._inventory);
    this._crafting.onCraft = (recipeId, recipe) => {
      this._quests?.reportEvent('craft', { item: recipe.name || recipeId, amount: 1 });
      this._awardXP(15);
    };
    this._techTree     = new TechTree();
    this._techTree.setConfig(TECH_UPGRADES);
    this._techTree.onUpgrade = (cat, techId, bonus) => this._applyTechBonus(bonus);
    this._audio        = new AudioManager();
    this._setLoad(75, 'Loading star systems…');
    this._currentSystem = this._galaxy.getSystems()[0];
    this._setLoad(80, 'Generating planet…');
    this._currentPlanet = PlanetGenerator.generate(this._currentSystem.id * 7 + 0);
    this._setLoad(87, 'Building terrain…');
    this._setupSurface(this._currentPlanet);
    this._setLoad(90, 'Spawning player…');
    this._setupPlayer();
    this._setupShip();
    this._setLoad(95, 'Starting quests…');
    this._quests.start('first_steps');
    this._setupQuestCallbacks();
    this._setLoad(100, 'Ready!');
    this._setupInput();
    this._setupTouchControls();
    await this._delay(400);
    this._hud.hideLoading();
    await this._delay(300);
    this._setState(GS.MAIN_MENU);
    this._hud.showMainMenu();
    this._loop();
  }

  _setLoad(pct, msg) {
    this._loadProgress = pct;
    if (this._hud) this._hud.setLoadingProgress(pct, msg);
    else {
      const bar = document.getElementById('loading-bar');
      const txt = document.getElementById('loading-msg');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = msg;
    }
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Renderer ────────────────────────────────────────────────────────────────
  _setupRenderer() {
    const canvas = document.getElementById('game-canvas');
    this._renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance'
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;
    this._renderer.outputColorSpace  = THREE.SRGBColorSpace;

    this._camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600000);
    this._camera.position.set(0, 20, 30);

    window.addEventListener('resize', () => this._onResize());
  }

  // ─── Scene + post-processing ─────────────────────────────────────────────────
  _setupScene() {
    this._scene = new THREE.Scene();
    this._scene.fog = new THREE.FogExp2(0x0a1020, 0.008);

    // Hemisphere light: sky → ground gradient
    this._hemi = new THREE.HemisphereLight(0x88aacc, 0x3a3010, 0.4);
    this._scene.add(this._hemi);

    // Ambient (planet-tinted fill)
    this._ambient = new THREE.AmbientLight(0x223344, 0.35);
    this._scene.add(this._ambient);

    // Sun (primary key light)
    this._sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    this._sun.position.set(300, 500, 200);
    this._sun.castShadow = true;
    this._sun.shadow.mapSize.set(2048, 2048);
    this._sun.shadow.camera.near = 0.5;
    this._sun.shadow.camera.far  = 600;   // tighter = sharper shadows
    this._sun.shadow.camera.left = this._sun.shadow.camera.bottom = -250;
    this._sun.shadow.camera.right = this._sun.shadow.camera.top  =  250;
    this._sun.shadow.bias = -0.0002;
    this._scene.add(this._sun);

    // Fill / back light (blue-ish night fill)
    this._fillLight = new THREE.DirectionalLight(0x2244aa, 0.25);
    this._fillLight.position.set(-200, 100, -300);
    this._scene.add(this._fillLight);

    // Post-processing
    this._composer = new EffectComposer(this._renderer);
    this._composer.addPass(new RenderPass(this._scene, this._camera));
    const bloomRadius = 0.5;
    const bloomStr    = window.devicePixelRatio <= 1 ? 0.75 : 0.9;
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStr, bloomRadius, 0.10
    );
    this._composer.addPass(this._bloomPass);
    const smaa = new SMAAPass(window.innerWidth * this._renderer.getPixelRatio(), window.innerHeight * this._renderer.getPixelRatio());
    this._composer.addPass(smaa);
    this._composer.addPass(new OutputPass());
  }

  // ─── Surface setup ────────────────────────────────────────────────────────────
  _setupSurface(planet) {
    // Clear old surface
    this._teardownSurface();

    // Apply planet atmosphere / fog
    if (planet.fogColor) this._scene.fog = new THREE.FogExp2(new THREE.Color(planet.fogColor).getHex(), planet.fogDensity || 0.008);
    if (planet.ambientColor) this._ambient.color.set(planet.ambientColor);

    // Per-planet sun color + intensity
    const sunCol = planet.sunColor || '#fff4e0';
    this._sun.color.set(sunCol);
    this._sun.intensity = 1.6;

    // Hemisphere light sky/ground colors from planet palette
    if (this._hemi) {
      this._hemi.color.set(planet.atmosphereColor || '#88aacc');
      this._hemi.groundColor.set(planet.ambientColor || '#3a3010');
      // Volcanic/burning → hot red hemisphere
      if (planet.type === 'VOLCANIC' || planet.type === 'BURNING') {
        this._hemi.groundColor.set('#400800');
        this._hemi.intensity = 0.6;
      } else if (planet.type === 'CRYSTAL' || planet.type === 'EXOTIC') {
        this._hemi.intensity = 0.5;
      } else {
        this._hemi.intensity = 0.35;
      }
    }

    // Bloom strength per planet type
    if (this._bloomPass) {
      const emissive = planet.emissiveStrength || 0;
      const base = window.devicePixelRatio <= 1 ? 0.7 : 0.85;
      this._bloomPass.strength = base + emissive * 0.6;
      this._bloomPass.threshold = planet.type === 'VOLCANIC' ? 0.05 : 0.10;
    }

    // Terrain
    this._terrain = new TerrainManager(this._scene, planet, this._sun);
    this._flora   = new FloraManager(this._scene, planet);
    this._creatures = new CreatureManager(this._scene, planet);
    this._mining  = new MiningSystem(this._scene, this._inventory);
    this._terrain.setManagers(this._flora, this._mining);

    // Planet atmosphere sky
    this._atmosphere = new PlanetAtmosphere(this._scene, planet);

    // Wire moon count into atmosphere shader
    if (this._atmosphere?.material?.uniforms?.uMoonCount) {
      this._atmosphere.material.uniforms.uMoonCount.value = Math.min((planet.moons || []).length, 3);
    }

    // Weather system
    this._weather = new WeatherSystem(this._scene, planet);

    // Auto-extractors
    this._extractor = new ExtractorManager(this._scene, this._inventory);

    // Space scene
    this._spaceScene = new SpaceScene(this._scene, this._galaxy);
    this._spaceScene.enterSystem(this._currentSystem);
    this._setSpaceVisible(false);

    // Physics world (re-created per planet)
    if (this._physicsWorld) this._physicsWorld.dispose(this._scene);
    this._physicsWorld = new PhysicsWorld();
  }

  _teardownSurface() {
    if (this._terrain)   { this._terrain.dispose();    this._terrain   = null; }
    if (this._flora)     { this._flora.dispose();      this._flora     = null; }
    if (this._creatures) { this._creatures.dispose();  this._creatures = null; }
    if (this._mining)    { this._mining.dispose();     this._mining    = null; }
    if (this._atmosphere){ this._atmosphere.dispose(); this._atmosphere= null; }
    if (this._weather)   { this._weather.dispose();    this._weather   = null; }
    if (this._extractor) { this._extractor.dispose();  this._extractor = null; }
  }

  _setSpaceVisible(visible) {
    if (this._spaceScene) {
      if (this._spaceScene.skyMesh)      this._spaceScene.skyMesh.visible      = visible;
      if (this._spaceScene.starPoints)   this._spaceScene.starPoints.visible   = visible;
      if (this._spaceScene.asteroidMesh) this._spaceScene.asteroidMesh.visible = visible;
      if (this._spaceScene.sunMesh)      this._spaceScene.sunMesh.visible      = visible;
    }
  }

  // ─── Player ──────────────────────────────────────────────────────────────────
  _setupPlayer() {
    this._player = new Player(this._scene, this._camera);
    // Wire footstep audio
    this._player.onFootstep = () => {
      if (this._audio?.initialized) this._audio.playOneShot('footstep');
    };
    // Apply per-planet gravity
    if (this._currentPlanet?.gravity) {
      this._player.setGravity(this._currentPlanet.gravity);
    }
    // Spawn on terrain
    const spawnX = 0, spawnZ = 0;
    if (this._terrain) {
      const sy = this._terrain.getHeightAt(spawnX, spawnZ);
      this._player.setPosition(new THREE.Vector3(spawnX, sy + 1, spawnZ));
    } else {
      this._player.setPosition(new THREE.Vector3(0, 5, 0));
    }
  }

  // ─── Ship ────────────────────────────────────────────────────────────────────
  _setupShip() {
    this._ship = new Ship(this._scene);
    const spawnX = 20, spawnZ = 10;
    if (this._terrain) {
      const sy = this._terrain.getHeightAt(spawnX, spawnZ);
      this._ship.mesh.position.set(spawnX, sy, spawnZ);
      this._ship._landingY = sy;
    } else {
      this._ship.mesh.position.set(20, 0, 10);
    }
  }

  // ─── Input ───────────────────────────────────────────────────────────────────
  _makeInput() {
    return {
      forward: false, back: false, left: false, right: false,
      sprint: false, jump: false, mine: false, scan: false,
      attack: false, interact: false,
      deployExtractor: false,
      mouseDX: 0, mouseDY: 0,
      // Ship
      shipThrust: 0, shipYaw: 0, shipPitch: 0, shipRoll: 0,
      // Joystick (touch)
      joyX: 0, joyY: 0,
      // Quickslot
      quickSlot: -1,
      // Multipliers applied by weather/status
      _weatherSpeedMult: 1.0,
      _statusSpeedMult : 1.0,
    };
  }

  _setupInput() {
    const inp = this._input;
    const keys = {};

    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Escape')        this._onEsc();
      if (e.code === 'Tab')           { e.preventDefault(); this._toggleInventory(); }
      if (e.code === 'KeyN')          this._toggleCrafting();
      if (e.code === 'KeyT')          this._toggleTech();
      if (e.code === 'KeyM')          this._toggleGalaxyMap();
      if (e.code === 'KeyG' && this.state === GS.PLANET_SURFACE) this._tryEnterShip();
      if (e.code === 'KeyG' && this.state === GS.SHIP_ATM)       this._tryExitShip();
      if (e.code === 'KeyP')          this._saveGame();
      if (e.code === 'KeyO')          this._loadGame();
      if (e.code === 'KeyB' && this.state === GS.PLANET_SURFACE)
        inp.deployExtractor = true;
      // Quickslot 1–0
      const digit = e.code.match(/^Digit(\d)$/);
      if (digit) { inp.quickSlot = parseInt(digit[1], 10) - 1; }
    });

    document.addEventListener('keyup', e => { keys[e.code] = false; });

    // Prevent right-click context menu in game
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Pointer lock
    canvas.addEventListener('click', () => {
      if (this.state !== GS.MAIN_MENU) canvas.requestPointerLock();
    });

    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        inp.mouseDX += e.movementX;
        inp.mouseDY += e.movementY;
      }
    });

    document.addEventListener('mousedown', e => {
      if (document.pointerLockElement === canvas) {
        if (e.button === 0) inp.mine   = true;
        if (e.button === 2) inp.attack = true;
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) inp.mine   = false;
      if (e.button === 2) inp.attack = false;
    });

    // Gamepad
    this._gamepadPoll = setInterval(() => this._pollGamepad(), 16);

    // Poll keyboard each frame (stored in closure)
    this._keyPoll = () => {
      inp.forward = !!(keys['KeyW'] || keys['ArrowUp']);
      inp.back    = !!(keys['KeyS'] || keys['ArrowDown']);
      inp.left    = !!(keys['KeyA'] || keys['ArrowLeft']);
      inp.right   = !!(keys['KeyD'] || keys['ArrowRight']);
      inp.sprint  = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
      inp.jump    = !!keys['Space'];
      inp.scan    = !!keys['KeyF'];

      // Ship controls (when in ship)
      inp.shipThrust = (keys['KeyW'] || keys['ArrowUp'])   ? 1 : (keys['KeyS'] || keys['ArrowDown'])  ? -0.3 : 0;
      inp.shipYaw    = (keys['KeyA'] || keys['ArrowLeft'])  ? -1 : (keys['KeyD'] || keys['ArrowRight']) ?  1   : 0;
      inp.shipPitch  = (keys['KeyW'] || keys['ArrowUp'])   ?  0.5 : (keys['KeyS'] || keys['ArrowDown']) ? -0.5 : 0;
    };
  }

  _pollGamepad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp  = gps[0];
    if (!gp) return;
    const inp = this._input;
    inp.joyX = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
    inp.joyY = Math.abs(gp.axes[1]) > 0.12 ? gp.axes[1] : 0;
    inp.jump   = gp.buttons[0]?.pressed || false;
    inp.sprint = gp.buttons[10]?.pressed || false;
    inp.mine   = gp.buttons[7]?.value > 0.3;
    inp.scan   = gp.buttons[4]?.pressed || false;
    inp.shipThrust = gp.buttons[7]?.value - gp.buttons[6]?.value || 0;
    inp.shipYaw    = inp.joyX;
    inp.shipPitch  = inp.joyY;
    // Apply joyY as forward/back
    if (Math.abs(inp.joyY) > 0.12) { inp.forward = inp.joyY < 0; inp.back = inp.joyY > 0; }
    if (Math.abs(inp.joyX) > 0.12) { inp.left = inp.joyX < 0; inp.right = inp.joyX > 0; }
  }

  // ─── Touch joystick ────────────────────────────────────────────────────────
  _setupTouchControls() {
    if (!('ontouchstart' in window)) return;

    const tc = document.getElementById('touch-controls');
    if (tc) tc.classList.remove('hidden');

    // Virtual joystick
    const base  = document.getElementById('joystick-base');
    const thumb = document.getElementById('joystick-thumb');
    if (!base || !thumb) return;

    let joyOrigin = null, joyId = -1;
    const R = 50;

    base.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const rect = base.getBoundingClientRect();
      joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        const dx = t.clientX - joyOrigin.x;
        const dy = t.clientY - joyOrigin.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const clamp = Math.min(dist, R);
        const nx = dx/dist * clamp || 0;
        const ny = dy/dist * clamp || 0;
        thumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
        this._input.joyX = nx / R;
        this._input.joyY = ny / R;
        this._input.forward = ny < -0.3;
        this._input.back    = ny >  0.3;
        this._input.left    = nx < -0.3;
        this._input.right   = nx >  0.3;
      }
    }, { passive: true });

    document.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = -1;
        thumb.style.transform = 'translate(-50%, -50%)';
        this._input.joyX = this._input.joyY = 0;
        this._input.forward = this._input.back = this._input.left = this._input.right = false;
      }
    }, { passive: true });

    // Touch buttons
    const btnMap = {
      'tb-attack': () => { this._input.mine = true;  setTimeout(() => this._input.mine  = false, 300); },
      'tb-q':      () => { /* ability Q */ },
      'tb-e':      () => { /* ability E */ },
      'tb-r':      () => { /* ability R */ },
      'tb-f':      () => { /* ultimate F */ },
      'tb-jump':   () => { this._input.jump = true;  setTimeout(() => this._input.jump  = false, 400); },
    };
    for (const [id, fn] of Object.entries(btnMap)) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('touchstart', fn, { passive: true });
    }

    // Right half of screen → look
    let lookId = -1, lookLast = null;
    document.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.55 && lookId === -1) {
          lookId = t.identifier;
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        this._input.mouseDX += (t.clientX - lookLast.x) * 1.4;
        this._input.mouseDY += (t.clientY - lookLast.y) * 1.4;
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }, { passive: true });
    document.addEventListener('touchend', e => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = -1;
    }, { passive: true });
  }

  // ─── State transitions ────────────────────────────────────────────────────────
  _setState(state) {
    this._prevState = this.state;
    this.state = state;

    if (state === GS.PLANET_SURFACE) {
      this._hud.showHUD();
      this._setSpaceVisible(false);
      if (this._terrain)    this._terrain.update(new THREE.Vector3(0,0,0));
      if (this._audio.initialized) this._audio.playAmbient(this._currentPlanet?.type || 'LUSH');
    }
    if (state === GS.SHIP_ATM) {
      this._hud.showHUD();
      this._hud.setGameState('ship');
    }
    if (state === GS.SPACE_LOCAL) {
      this._hud.showHUD();
      this._hud.setGameState('space');
      this._setSpaceVisible(true);
      this._teardownSurface();
    }
    if (state === GS.MAIN_MENU) {
      this._hud.hideHUD();
    }
  }

  selectClass(classId) {
    const colors = { runekeeper: 0x4488ff, technomancer: 0xff8800, voidhunter: 0xaa00ff };
    if (this._player) this._player.setClass(classId, colors[classId] || 0x4488ff);
    this._hud.hideMainMenu();
    if (!this._audio.initialized) this._audio.init();
    this._audio.playAmbient(this._currentPlanet?.type || 'LUSH');
    this._setState(GS.PLANET_SURFACE);
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.requestPointerLock();
  }

  _onEsc() {
    if (this.state === GS.PAUSED)        { this.resume(); return; }
    if (this.state === GS.GALAXY_MAP)    { this._hud.hideGalaxyMap(); this._setState(this._prevState); return; }
    const over = document.querySelector('.screen-overlay:not(.hidden)');
    if (over) { over.classList.add('hidden'); return; }
    if ([GS.PLANET_SURFACE, GS.SHIP_ATM, GS.SPACE_LOCAL].includes(this.state)) {
      this._setState(GS.PAUSED);
      this._hud.showPause();
      document.exitPointerLock();
    }
  }

  resume() {
    this._hud.hidePause();
    this._setState(this._prevState || GS.PLANET_SURFACE);
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.requestPointerLock();
  }

  goToMainMenu() {
    this._hud.hidePause();
    this._hud.hideDeath();
    this._setState(GS.MAIN_MENU);
    this._hud.showMainMenu();
    document.exitPointerLock();
  }

  respawn() {
    this._hud.hideDeath();
    if (this._player) {
      // Partial restore (not full — AAA-style consequence)
      this._player.hp      = Math.floor(this._player.maxHp * 0.5);
      this._player.shield  = 0;
      this._player.lifeSup = 100;
      // Drop 50% of inventory at death site
      if (this._inventory && this._mining && this._deathPos) {
        const items = this._inventory.getAllItems();
        const toDrop = items.filter(() => Math.random() < DEATH_PENALTY_DROP_RATE);
        for (const it of toDrop) {
          if (it.amount > 0) {
            const drop = Math.ceil(it.amount * 0.5);
            const scatter = new THREE.Vector3(
              this._deathPos.x + (Math.random()-0.5) * 4,
              this._deathPos.y,
              this._deathPos.z + (Math.random()-0.5) * 4
            );
            this._mining.spawnResourceNode(scatter, it.type, drop, this._currentPlanet?.seed || 0);
            this._inventory.removeItem(it.type, drop);
          }
        }
        this._hud.showNotification(`☠ Death cache dropped at last location`, 'warn', 4000);
      }
      // Respawn at ship
      const shipPos = this._ship?.getPosition();
      const spawnX  = shipPos?.x ?? 0;
      const spawnZ  = shipPos?.z ?? 0;
      const sy      = this._terrain ? this._terrain.getHeightAt(spawnX, spawnZ) : 5;
      this._player.setPosition(new THREE.Vector3(spawnX, sy + 1, spawnZ));
    }
    this._setState(GS.PLANET_SURFACE);
    this._hud.showNotification('💫 Respawned at 50% HP — recover your cache!', 'warn', 5000);
  }

  _tryEnterShip() {
    if (!this._ship || !this._player) return;
    if (this._ship.isPlayerNear(this._player.getPosition())) {
      this._ship.enterShip(this._player);
      this._setState(GS.SHIP_ATM);
      this._hud.showNotification('Entered ship – WASD to fly, W for thrust', 'info', 4000);
    } else {
      this._hud.showNotification('Not close enough to ship', 'warn', 2000);
    }
  }

  _tryExitShip() {
    if (!this._ship || !this._player) return;
    if (this._ship.mode === FlightMode.LANDED) {
      this._ship.exitShip(this._player);
      this._setState(GS.PLANET_SURFACE);
    } else {
      this._hud.showNotification('Land first before exiting', 'warn', 2000);
    }
  }

  _toggleInventory() {
    const s = document.getElementById('inventory-screen');
    if (!s) return;
    const hidden = s.classList.toggle('hidden');
    if (!hidden) this._hud._renderInventoryGrid(this._inventory);
  }

  _toggleCrafting() {
    const s = document.getElementById('craft-screen');
    if (!s) return;
    const hidden = s.classList.toggle('hidden');
    if (!hidden) this._hud.showCraftingMenu(this._crafting, this._inventory);
  }

  _toggleTech() {
    const s = document.getElementById('tech-screen');
    if (!s) return;
    if (s.classList.contains('hidden')) {
      this._hud.showTechScreen(this._techTree, this._inventory);
    } else {
      this._hud.hideTechScreen();
    }
  }

  _toggleGalaxyMap() {
    if (this.state === GS.GALAXY_MAP) {
      this._hud.hideGalaxyMap();
      this._setState(this._prevState);
    } else {
      this._prevState = this.state;
      this._setState(GS.GALAXY_MAP);
      this._hud.showGalaxyMap(this._galaxy, this._currentSystem?.id, (sys) => this._warpToSystem(sys));
    }
  }

  _warpToSystem(sys) {
    if (!sys) return;
    if (sys.id === this._currentSystem?.id) {
      this._hud.showNotification('Already in this system', 'warn', 2000);
      return;
    }
    // Cost: 1 Warp Cell
    if (this._inventory && this._inventory.getAmount('Warp Cell') < WARP_FUEL_COST) {
      this._hud.showNotification('⚡ Need 1 Warp Cell to jump!', 'warn', 2500);
      return;
    }
    if (this._inventory) this._inventory.removeItem('Warp Cell', WARP_FUEL_COST);
    this._audio?.playOneShot('warp');
    this._currentSystem = sys;
    sys.visited = true;
    const planet = PlanetGenerator.getSystemPlanets(sys.seed, sys)[0];
    this._currentPlanet = planet;
    this._hud.hideGalaxyMap();
    this._setState(this._prevState || GS.PLANET_SURFACE);
    this._teardownSurface();
    this._setupSurface(planet);
    this._setupPlayer();
    this._setupShip();
    this._hud.showNotification(`🚀 Warped to ${sys.name}`, 'info', 3500);
    this._awardXP(50);
    this._quests.reportEvent('warp');
    // Auto-start chain quest if not already active or completed
    if (!this._quests.isCompleted('survival_basics') &&
        !this._quests.getActive().some(q => q.id === 'survival_basics')) {
      this._quests.start('survival_basics');
    }
  }

  // ─── Resize ──────────────────────────────────────────────────────────────────
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this._renderer.setSize(w, h);
    this._composer.setSize(w, h);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  // ─── RAF loop ─────────────────────────────────────────────────────────────────
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);

    if (this._keyPoll) this._keyPoll();

    if (this.state === GS.PLANET_SURFACE) {
      this._tickSurface(dt);
    } else if (this.state === GS.SHIP_ATM) {
      this._tickShip(dt);
    } else if (this.state === GS.SPACE_LOCAL) {
      this._tickSpace(dt);
    }

    // Atmosphere/sky time
    if (this._atmosphere) this._atmosphere.update(dt, this._sun.position.clone().normalize(), this._player?.getPosition() || new THREE.Vector3());

    // HUD update
    const gs = this.state === GS.SHIP_ATM ? 'ship' : this.state === GS.SPACE_LOCAL ? 'space' : 'surface';
    if (this._player && this._mining) {
      this._player._miningProgress = this._mining.getMiningProgress();
    }
    this._hud.update(dt, this._player, this._currentPlanet, this._ship, this._terrain, gs, this._creatures, this._mining);

    this._composer.render();
  }

  _tickSurface(dt) {
    if (!this._player) return;
    const inp = this._input;

    // Interaction hint
    if (this._ship && this._ship.isPlayerNear(this._player.getPosition())) {
      this._ship.showEntryZone(true);
      this._hud.showInteractionPrompt('[G] Enter Ship');
    } else {
      this._ship?.showEntryZone(false);
      this._hud.hideInteractionPrompt();
    }

    // Terrain streaming
    const pos = this._player.getPosition();
    if (this._terrain)   this._terrain.update(pos, dt);
    if (this._flora)     this._flora.update(dt, Date.now() * 0.001);
    if (this._creatures) this._creatures.update(dt, pos, this._terrain ? (x,z) => this._terrain.getHeightAt(x,z) : null);

    // Mining – track resources gained for XP
    const prevMiningProgress = this._mining?.getMiningProgress() || 0;
    if (this._mining)    this._mining.update(dt, pos, inp.mine, null, this._terrain ? (x,z) => this._terrain.getHeightAt(x,z) : null);
    const curMiningProgress  = this._mining?.getMiningProgress() || 0;
    if (inp.mine && curMiningProgress < prevMiningProgress && prevMiningProgress > 0) {
      // A mining cycle just completed (progress reset)
      this._awardXP(XP_PER_MINE_ITEM * XP_MINE_CYCLE_MULT);
      const target = this._mining?.getMiningTarget?.();
      if (target) this._quests.reportEvent('collect', { resource: target.resourceType, amount: 10 });
    }

    // Weather gameplay effects
    if (this._weather) {
      this._weather.update(dt, pos);
      this._hud.setWeather(this._weather.getWeatherName(), this._weather.getWindStrength());
      const wn = this._weather.getWeatherName();
      // Blizzard/Sandstorm/Storm slow down player
      inp._weatherSpeedMult = (wn === 'Blizzard' || wn === 'Sandstorm') ? WEATHER_SPEED_BLIZZARD
                             : wn === 'Storm'                            ? WEATHER_SPEED_STORM : 1.0;
      // Toxic Fog drains life support
      if (wn === 'Toxic Fog') this._player.drainLifeSupport(4 * dt);
      // Blizzard drains life support
      if (wn === 'Blizzard')  this._player.drainLifeSupport(2 * dt);
    }

    // Player
    this._player.update(dt, inp, this._terrain, this._mining);

    // Ship idle
    this._ship?.update(dt, { shipThrust:0,shipYaw:0,shipPitch:0 }, this._terrain);

    // ─── Creature combat – hostile creatures deal damage to player ────────────
    this._combatTimer += dt;
    if (this._combatTimer >= COMBAT_TICK_INTERVAL && this._creatures) {
      this._combatTimer = 0;
      const nearby = this._creatures.getNearbyCreatures(pos, 4);
      for (const cr of nearby) {
        if (cr.genome?.aggression === 'hostile' && cr.state === CREATURE_STATE.ATTACKING) {
          const dmg = cr.genome.bodySize * 8;
          const actual = this._player.applyDamage(dmg, 'creature');
          if (actual > 0) {
            this._audio?.playOneShot('hit');
            this._hud.flashDamage?.();
            this._hud.showNotification(`⚔ Attacked! −${Math.floor(actual)} HP`, 'warn', 1500);
            // Show damage number at roughly screen-centre
            this._hud.showDamageNumber(
              window.innerWidth  * 0.5 + (Math.random()-0.5)*80,
              window.innerHeight * 0.5 + (Math.random()-0.5)*40,
              actual, 'enemy'
            );
          }
        }
      }
    }

    // ─── Player attack (right-click / R2) — projectile-based ─────────────────
    this._attackCooldown -= dt;
    if (inp.attack && this._attackCooldown <= 0 && this._physicsWorld) {
      this._attackCooldown = ATTACK_COOLDOWN;

      // Fire projectile from player eye position in camera direction
      const eyePos = pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      const camDir = new THREE.Vector3(
        -Math.sin(this._player._camYaw) * Math.cos(this._player._camPitch),
        -Math.sin(this._player._camPitch),
        -Math.cos(this._player._camYaw) * Math.cos(this._player._camPitch)
      ).normalize();

      this._physicsWorld.fireProjectile(eyePos, camDir, 'player', this._scene, 0x00aaff);
      this._audio?.playOneShot('attack_shoot');
    }

    // ─── Projectile hit resolution ────────────────────────────────────────────
    if (this._physicsWorld && this._creatures) {
      const aliveCreatures = this._creatures.getNearbyCreatures(pos, 200);
      const projHits = this._physicsWorld.stepProjectiles(
        dt, this._scene, aliveCreatures,
        this._terrain ? (x, z) => this._terrain.getHeightAt(x, z) : null
      );
      for (const { target } of projHits) {
        const died = target.takeDamage(ATTACK_DAMAGE);
        this._hud.showNotification(`🔫 Hit! −${ATTACK_DAMAGE}`, 'success', 700);
        if (died) {
          this._audio?.playOneShot('creature_kill');
          this._awardXP(XP_PER_KILL);
          this._quests.reportEvent('kill');
          this._hud.showNotification(`💀 Creature defeated  +${XP_PER_KILL} XP`, 'success', 2000);
          this._dropCreatureLoot(target.getPosition().clone());
        }
      }
    }

    // ─── Creature melee hits on player ────────────────────────────────────────
    if (this._creatures) {
      const meleeHits = this._creatures.drainPendingHits?.() ?? [];
      for (const { damage } of meleeHits) {
        const absorbed = this._player.absorbDamage?.(damage) ?? 0;
        const taken = damage - absorbed;
        if (taken > 0) {
          this._player.takeDamage(taken);
          this._audio?.playOneShot('hit');
          this._hud.showNotification(`💥 Hit for ${taken} dmg`, 'danger', 1000);
        }
      }
    }

    // Scanner – F key
    this._scanCooldown -= dt;
    if (inp.scan && this._scanCooldown <= 0) {
      this._scanCooldown = SCAN_COOLDOWN_DURATION;
      this._doScan(pos);
    }

    // Life support drain in hazardous environments
    if (this._currentPlanet) {
      const haz = (this._currentPlanet.toxicity || 0) + (this._currentPlanet.radiation || 0);
      if (haz > 0.3) this._player.drainLifeSupport(haz * 2 * dt);
      else           this._player.refillLifeSupport(5 * dt);
    }

    // Hazard overlay
    if (this._currentPlanet) {
      this._hud.updateHazardOverlay(this._currentPlanet.hazardType, this._currentPlanet);
    }

    // HUD: update level/XP, quickslot bar, resource indicator
    this._hud.setLevel(this._level, this._xp, this._xpToNext);
    this._hud.updateQuickBar?.(this._inventory);

    // ─── Quickslot use ────────────────────────────────────────────────────────
    if (inp.quickSlot >= 0) {
      this._hud.selectQuickSlot(inp.quickSlot);
      // Use item in that slot
      const slot = this._inventory.slots[inp.quickSlot];
      if (slot) {
        let used = false;
        if (slot.type === 'Medkit' && this._player.hp < this._player.maxHp) {
          this._player.heal(40);
          this._inventory.removeItem('Medkit', 1);
          this._hud.showNotification('💊 Medkit used  +40 HP', 'success', 2000);
          this._audio?.playOneShot('discovery');
          used = true;
        } else if (slot.type === 'Shield Battery' && this._player.shield < this._player.maxShield) {
          this._player.shield = Math.min(this._player.maxShield, this._player.shield + 60);
          this._player._shieldRegenTimer = 0;
          this._inventory.removeItem('Shield Battery', 1);
          this._hud.showNotification('🛡 Shield Battery used  +60 Shield', 'success', 2000);
          this._audio?.playOneShot('ability');
          used = true;
        }
        if (used) this._hud.updateQuickBar?.(this._inventory);
      }
      inp.quickSlot = -1;
    }

    // ─── Resource indicator ───────────────────────────────────────────────────
    if (this._mining) {
      const nodes = this._mining.getNodesNear(pos, 200);
      if (nodes.length > 0) {
        // Find nearest
        let nearest = nodes[0];
        let nearDist = pos.distanceTo(nearest.pos);
        for (const n of nodes) {
          const d = pos.distanceTo(n.pos);
          if (d < nearDist) { nearDist = d; nearest = n; }
        }
        if (nearDist > 6) {
          // Direction in world → player-relative angle
          const dx = nearest.pos.x - pos.x;
          const dz = nearest.pos.z - pos.z;
          const worldAngle = Math.atan2(dx, dz);
          const relAngle   = worldAngle - (this._player._camYaw || 0);
          this._hud.setResourceIndicator?.(relAngle, nearDist, nearest.resourceType);
        } else {
          this._hud.setResourceIndicator?.(null);
        }
      } else {
        this._hud.setResourceIndicator?.(null);
      }
    }

    // Player death
    if (!this._player.isAlive()) {
      this._deathPos = this._player.getPosition().clone();
      this._setState(GS.DEAD);
      this._hud.showDeath();
    }

    // ─── Status effects ──────────────────────────────────────────────────────
    const expired = this._status.update(dt, this._player);
    for (const id of expired) {
      const def = StatusEffectManager.DEFS[id];
      const label = def ? def.label : id;
      this._hud.showNotification(`${label} cleared`, 'info', 1500);
    }
    // Apply status speed multiplier on top of weather multiplier
    inp._statusSpeedMult = this._status.getSpeedMult();

    // Apply biome-based status effects automatically
    if (this._currentPlanet) {
      const wn = this._weather?.getWeatherName();
      if (this._currentPlanet.type === 'BURNING' && !this._status.has('burning'))
        this._status.apply('burning');
      if (wn === 'Blizzard' && !this._status.has('frozen'))
        this._status.apply('frozen');
      if (wn === 'Toxic Fog' && !this._status.has('poisoned'))
        this._status.apply('poisoned');
      if (this._currentPlanet.type === 'EXOTIC' && wn === 'Aurora' && !this._status.has('energised'))
        this._status.apply('energised');
    }
    // Update HUD status icons
    this._hud.setStatusEffects?.(this._status.getHudIcons());

    // ─── Auto-Extractor update ────────────────────────────────────────────────
    if (this._extractor) this._extractor.update(dt, this._mining);

    // ─── Deploy extractor with B key ──────────────────────────────────────────
    if (inp.deployExtractor && this._extractor) {
      inp.deployExtractor = false;
      const placed = this._extractor.place(pos, this._inventory, this._mining);
      if (placed) {
        this._hud.showNotification('⚙ Auto-Extractor placed!', 'success', 2500);
        this._awardXP(25);
      } else {
        const cost = this._extractor.getCraftCost();
        const missing = Object.entries(cost).filter(([t,a]) => this._inventory.getAmount(t) < a)
          .map(([t,a]) => `${t} ×${a}`).join(', ');
        this._hud.showNotification(`Cannot place extractor – need: ${missing}`, 'warn', 3000);
      }
    }

    // ─── Quest events ─────────────────────────────────────────────────────────
    // Quest collect events are fired in the mining cycle completion block above
    // (where amount > 0 is guaranteed). Remove the zero-amount polling here.

    // Update quest HUD summary
    const questSummary = this._quests.getHudSummary();
    this._hud.setQuestSummary?.(questSummary);

    // ─── Boss bar ─────────────────────────────────────────────────────────────
    const boss = this._creatures?.getNearestBoss(pos, 60);
    if (boss) {
      this._hud.showBossBar?.(boss.genome.isBoss ? 'ALPHA CREATURE' : 'BOSS', boss.getHpPct());
    } else {
      this._hud.hideBossBar?.();
    }

    // Day/night cycle
    this._updateDayNight(dt);

    // Sync audio wind intensity with weather
    if (this._audio?.initialized && this._weather) {
      const intensity = this._weather.getIntensity?.() ?? 0;
      this._audio.update(dt, intensity);
    }

    // Auto-save every AUTO_SAVE_INTERVAL seconds
    this._autoSaveTimer += dt;
    if (this._autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this._autoSaveTimer = 0;
      this._saveGame(true);
    }
  }

  // ─── XP / Leveling ─────────────────────────────────────────────────────────
  _awardXP(amount) {
    this._xp += amount;
    while (this._xp >= this._xpToNext) {
      this._xp -= this._xpToNext;
      this._level++;
      this._xpToNext = Math.floor(XP_BASE * Math.pow(XP_GROWTH, this._level - 1));
      this._audio?.playOneShot('level_up');
      this._hud.flashLevelUp?.();
      this._hud.showNotification(`⬆ LEVEL UP!  Now Level ${this._level}`, 'success', 3500);
      if (this._player) this._player.heal(30);
    }
  }

  // ─── Tech bonus application ──────────────────────────────────────────────────
  _applyTechBonus(bonus) {
    if (!this._player || !bonus) return;
    for (const [stat, val] of Object.entries(bonus)) {
      switch (stat) {
        case 'shieldMax':
          this._player.maxShield += val;
          this._player.shield = Math.min(this._player.shield + val, this._player.maxShield);
          break;
        case 'jetpackCapacity':
          this._player.jetpackFuel = Math.min(this._player.jetpackFuel + val, _PCFG.JETPACK_FUEL + val);
          break;
        case 'lifeSupportRate':
          // Applied per-tick via player.lifeSupportDrainMult; track cumulative
          this._player._techLifeSupportBonus = (this._player._techLifeSupportBonus || 0) + val;
          break;
        case 'hazardProtection':
          this._player.hazardProt += val;
          break;
        case 'miningSpeed':
          // Mining speed boost applied as multiplier
          this._player._techMiningMult = (this._player._techMiningMult || 1.0) + (val - 1.0);
          break;
        case 'scanRange':
          this._player._techScanBonus = (this._player._techScanBonus || 0) + val;
          break;
        default:
          break;
      }
    }
    this._hud.showNotification('⚙ Tech bonus applied!', 'upgrade', 2000);
  }

  // ─── Creature loot drop ─────────────────────────────────────────────────────
  _dropCreatureLoot(worldPos) {
    if (!this._mining) return;
    if (Math.random() < CREATURE_LOOT_DROP_CHANCE) {
      const types  = ['Carbon', 'Ferrite Dust', 'Di-Hydrogen', 'Sodium'];
      const type   = types[Math.floor(Math.random() * types.length)];
      const amount = 5 + Math.floor(Math.random() * 25);
      const scatter = worldPos.clone().add(
        new THREE.Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2)
      );
      this._mining.spawnResourceNode(scatter, type, amount, this._currentPlanet?.seed || 0);
    }
  }

  _tickShip(dt) {
    if (!this._ship || !this._player) return;
    this._ship.update(dt, this._input, this._terrain);

    // Follow camera to ship
    const sp = this._ship.getPosition();
    const cOff = new THREE.Vector3(0, 8, 20);
    this._camera.position.lerp(sp.clone().add(cOff), 0.1);
    this._camera.lookAt(sp);

    // Transition to surface if landed
    if (this._ship.mode === FlightMode.LANDED && this._ship._playerInside) {
      this._hud.showInteractionPrompt('[G] Exit Ship');
    } else {
      this._hud.hideInteractionPrompt();
    }

    // Transition to space
    if (this._ship.mode === FlightMode.SPACE) {
      this._setState(GS.SPACE_LOCAL);
    }

    // Day/night
    this._updateDayNight(dt);
  }

  _tickSpace(dt) {
    if (!this._ship) return;
    this._ship.update(dt, this._input, null);
    const sp = this._ship.getPosition();
    const cOff = new THREE.Vector3(0, 4, 16);
    this._camera.position.lerp(sp.clone().add(cOff), 0.1);
    this._camera.lookAt(sp);

    // Move skybox/starfield with ship
    if (this._spaceScene?.skyMesh) this._spaceScene.skyMesh.position.copy(sp);
    if (this._spaceScene?.starPoints) this._spaceScene.starPoints.position.copy(sp);

    // ─── Gravity wells near planets ──────────────────────────────────────────
    if (this._spaceScene && this._physicsWorld) {
      // Rebuild gravity wells every 2s (cheap – just recreate from planet list)
      this._gwTimer = (this._gwTimer || 0) + dt;
      if (this._gwTimer > 2.0) {
        this._gwTimer = 0;
        this._physicsWorld.clearGravityWells();
        for (const pm of this._spaceScene.planetMeshes || []) {
          if (!pm.userData.planetConfig) continue;
          const r = pm.userData.orbitRadius || 600;
          // Gentle pull – strength 0.8 m/s² at rim, radius = 5× planet visual size
          const wellR = Math.max(r * 0.15, 1200);
          this._physicsWorld.addGravityWell(pm.position, 0.8, wellR);
        }
      }
      // Apply gravity wells to ship velocity
      const shipVel = this._ship._vel;
      for (const w of this._physicsWorld.gravityWells) {
        const dist = sp.distanceTo(w.position);
        if (dist < w.radius && dist > 10) {
          const pull = w.position.clone().sub(sp).normalize();
          const mag  = w.strength * (1 - dist / w.radius) * dt;
          shipVel.addScaledVector(pull, mag);
        }
      }
    }

    // ─── Space distance HUD ──────────────────────────────────────────────────
    if (this._spaceScene && this._hud) {
      const distFromOrigin = sp.length();
      const distKm = Math.round(distFromOrigin / 10); // 1 unit ≈ 10 km
      const distAU = (distFromOrigin / 14960).toFixed(2); // 14960 units ≈ 1 AU
      let nearest = null, nearestDist = Infinity;
      for (const pm of this._spaceScene.planetMeshes || []) {
        const d = sp.distanceTo(pm.position);
        if (d < nearestDist) { nearestDist = d; nearest = pm; }
      }
      const nearestName = nearest?.userData.planetConfig?.name ?? '---';
      const nearestKm   = Math.round(nearestDist / 10);
      this._hud.setSpaceDistances?.({ distKm, distAU, nearestName, nearestKm });
    }

    // Check if near planet to re-enter
    if (this._spaceScene) {
      const entry = this._spaceScene.getPlanetAt(sp, 5000);
      if (entry) {
        this._hud.showNotification(`Entering atmosphere of ${entry.name}…`, 'info', 3000);
        this._currentPlanet = entry;
        this._setupSurface(entry);
        this._setupPlayer();
        this._ship._vel.set(0, -20, 0);
        this._ship.mode = FlightMode.ATMOSPHERIC;
        this._setState(GS.SHIP_ATM);
      }
    }
  }

  _dayTime = 0;
  _updateDayNight(dt) {
    this._dayTime = (this._dayTime || 0) + dt;
    const cycle = this._currentPlanet?.dayDuration || 600;
    const t  = (this._dayTime % cycle) / cycle;
    const sunAngle = t * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), 0.4).normalize();
    const playerPos = this._player?.getPosition() || new THREE.Vector3();

    // Shadow camera follows player for sharp local shadows
    this._sun.position.set(
      playerPos.x + sunDir.x * 300,
      playerPos.y + Math.abs(sunDir.y) * 400 + 50,
      playerPos.z + sunDir.z * 150
    );
    this._sun.target.position.copy(playerPos);
    this._sun.target.updateMatrixWorld();

    const dayFactor = Math.max(0, sunDir.y);
    const nightFactor = 1 - dayFactor;

    // Smooth ambient transitions
    this._ambient.intensity = 0.12 + dayFactor * 0.38;

    // Sun warmth: orange at horizon, white at zenith
    const horizonWarmth = Math.max(0, 1 - Math.abs(sunDir.y) * 3);
    this._sun.color.lerpColors(
      new THREE.Color(this._currentPlanet?.sunColor || '#fff4e0'),
      new THREE.Color(0xff8820),
      horizonWarmth * 0.4
    );
    this._sun.intensity = 0.3 + dayFactor * 1.3;

    // Hemisphere: sky blue at day, deep blue at night
    if (this._hemi) {
      const skyDay   = new THREE.Color(this._currentPlanet?.atmosphereColor || '#88aacc');
      const skyNight = new THREE.Color(0x050820);
      this._hemi.color.lerpColors(skyDay, skyNight, nightFactor * 0.85);
      this._hemi.intensity = 0.2 + dayFactor * 0.3;
    }

    // Fill light: blue moonlight at night
    if (this._fillLight) {
      this._fillLight.intensity = nightFactor * 0.35;
    }

    // Sync terrain shader sun direction
    if (this._terrain) this._terrain.setSunDirection(sunDir);
    if (this._atmosphere) this._atmosphere.update(dt, sunDir, playerPos);

    // Bloom: brighter at noon, minimal at night (but emissive planets keep base)
    if (this._bloomPass) {
      const emissive = this._currentPlanet?.emissiveStrength || 0;
      const base = window.devicePixelRatio <= 1 ? 0.5 : 0.6;
      this._bloomPass.strength = base + dayFactor * 0.4 + emissive * 0.5;
    }

    // Tone mapping exposure: brighter at day
    this._renderer.toneMappingExposure = 0.9 + dayFactor * 0.35;

    // Fog: thicker at night / dusk
    if (this._scene.fog) {
      this._scene.fog.density = (this._currentPlanet?.fogDensity || 0.008) * (0.7 + nightFactor * 0.4);
    }

    // PLANETARY HAZARDS based on per-planet rates
    if (this._currentPlanet && this._player) {
      const rates = this._currentPlanet.hazardRates || {};
      const wn = this._weather?.getWeatherName?.() || 'Clear';
      const prot = this._player.hazardProt || 0;  // 0–100 from tech
      const protMult = 1 - prot / 100;

      // Heat damage (BURNING, VOLCANIC, DESERT)
      if (rates.heat > 0) {
        const stormy = (wn === 'Storm' || wn === 'Sandstorm') ? 2 : 1;
        this._player.drainLifeSupport(rates.heat * dt * stormy * protMult);
      }
      // Cold damage (FROZEN, ARCTIC)
      if (rates.cold > 0) {
        const bliz = (wn === 'Blizzard') ? 2 : 1;
        this._player.drainLifeSupport(rates.cold * dt * bliz * protMult);
      }
      // Radiation damage (DEAD, VOLCANIC)
      if (rates.radiation > 0) {
        this._player.takeDamage?.(rates.radiation * dt * protMult);
      }
      // Toxic damage (TOXIC, SWAMP)
      if (rates.toxic > 0) {
        const fog = (wn === 'Toxic Fog') ? 2 : 1;
        this._player.drainLifeSupport(rates.toxic * dt * fog * protMult);
      }
    }
  }

  // ─── Scanner ─────────────────────────────────────────────────────────────────
  _doScan(playerPos) {
    const lines = [];

    // Planet summary
    if (this._currentPlanet) {
      const p = this._currentPlanet;
      lines.push(`🌍 ${p.name} · ${p.type}`);
      lines.push(`🌡 ${p.temperature?.toFixed(0) ?? '?'}°C  ☢ RAD ${((p.radiation||0)*100).toFixed(0)}%  ☣ TOX ${((p.toxicity||0)*100).toFixed(0)}%`);
      if (this._weather) lines.push(`🌤 Weather: ${this._weather.getWeatherName()}`);
    }

    // Nearby creatures
    if (this._creatures) {
      const crs = this._creatures.getNearbyCreatures(playerPos, SCANNER_RANGE);
      if (crs.length > 0) {
        lines.push(`──── Fauna (${crs.length} detected) ────`);
        const shown = crs.slice(0, 3);
        for (const cr of shown) {
          const g = cr.genome;
          const legs = g.legCount === 0 ? 'Slitherer' : `${g.legCount}-legged`;
          const beh  = g.aggression === 'hostile' ? '⚠ Hostile' : g.aggression === 'curious' ? '🔍 Curious' : '✓ Passive';
          const biol = g.isBiolum ? ' [Bioluminescent]' : '';
          lines.push(`  • ${legs} · HP ${g.maxHp} · ${beh}${biol}`);
        }
        if (crs.length > 3) lines.push(`  …and ${crs.length - 3} more`);
      } else {
        lines.push('  No fauna in range.');
      }
    }

    // Nearby resources
    if (this._mining) {
      const nodes = this._mining.getNodesNear(playerPos, SCANNER_RANGE);
      if (nodes.length > 0) {
        lines.push(`──── Resources (${nodes.length} detected) ────`);
        // Group by type
        const counts = {};
        for (const n of nodes) counts[n.resourceType] = (counts[n.resourceType] || 0) + 1;
        for (const [type, cnt] of Object.entries(counts)) {
          lines.push(`  • ${type} ×${cnt}`);
        }
      }
    }

    this._hud.showScanResults(lines);
    this._quests.reportEvent('scan');
  }

  // ─── Quest callbacks ──────────────────────────────────────────────────────────
  _setupQuestCallbacks() {
    this._quests.on('started', qs => {
      this._hud.showNotification(`📜 New Quest: ${qs.def.title}`, 'info', 4000);
    });
    this._quests.on('progress', qs => {
      // silent – quest HUD tracker updates in update loop
    });
    this._quests.on('completed', qs => {
      this._hud.showNotification(`✅ Quest Complete: ${qs.def.title}`, 'success', 5000);
      if (qs.def.reward) {
        this._awardXP(qs.def.reward.xp || 0);
        for (const [type, amt] of Object.entries(qs.def.reward.items || {})) {
          this._inventory.addItem(type, amt);
        }
        this._hud.showNotification(`🎁 Reward: +${qs.def.reward.xp} XP`, 'success', 3000);
      }
    });
  }

  // ─── Save / Load ─────────────────────────────────────────────────────────────
  _saveGame(silent = false) {
    try {
      const data = {
        version: 3,
        systemId: this._currentSystem?.id,
        planetSeed: this._currentPlanet?.seed,
        planetType: this._currentPlanet?.type,
        dayTime: this._dayTime || 0,
        player: this._player?.serializeState(),
        inventory: this._inventory?.serialize(),
        level: this._level,
        xp: this._xp,
        xpToNext: this._xpToNext,
        techTree: this._techTree?.serialize(),
        quests: this._quests?.serialize(),
        status: this._status?.serialize(),
        extractors: this._extractor?.serialize(),
      };
      localStorage.setItem('aetheria_save', JSON.stringify(data));
      if (!silent) this._hud.showNotification('💾 Game saved', 'info', 2000);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  _loadGame() {
    try {
      const raw = localStorage.getItem('aetheria_save');
      if (!raw) { this._hud.showNotification('No save found', 'warn', 2000); return; }
      const data = JSON.parse(raw);
      if (data.player    && this._player)    this._player.loadState(data.player);
      if (data.inventory && this._inventory) this._inventory.load(data.inventory);
      if (data.dayTime   != null)            this._dayTime = data.dayTime;
      if (data.level     != null)            this._level   = data.level;
      if (data.xp        != null)            this._xp      = data.xp;
      if (data.xpToNext  != null)            this._xpToNext = data.xpToNext;
      if (data.techTree  && this._techTree)  this._techTree.load(data.techTree);
      if (data.quests    && this._quests)    this._quests.load(data.quests);
      if (data.status    && this._status)    this._status.load(data.status);
      if (data.extractors && this._extractor) this._extractor.load(data.extractors, this._mining);
      this._hud.showNotification('💾 Game loaded', 'info', 2000);
    } catch (e) {
      console.warn('Load failed:', e);
      this._hud.showNotification('Load failed', 'error', 2000);
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const game = new Game();
window.game = game;
game.init().catch(err => {
  console.error('Game init failed:', err);
  const msg = document.getElementById('loading-msg');
  if (msg) msg.textContent = 'Error: ' + err.message;
});
