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
import { CreatureManager }    from './creatures.js';
import { CREATURE_STATE }     from './creatures.js';
import { MiningSystem }       from './mining.js';
import { Player }             from './player.js';
import { Ship, FlightMode }   from './ship.js';
import { SpaceScene }         from './space.js';
import { Inventory }          from './inventory.js';
import { CraftingSystem }     from './crafting.js';
import { AudioManager }       from './audio.js';
import { GameHUD }             from './ui.js';
import { getAssets }           from './assets.js';
import { WeatherSystem }       from './weather.js';

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
    this._weather       = null;
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

    // Ambient
    this._ambient = new THREE.AmbientLight(0x223344, 0.5);
    this._scene.add(this._ambient);

    // Sun
    this._sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    this._sun.position.set(300, 500, 200);
    this._sun.castShadow = true;
    this._sun.shadow.mapSize.set(2048, 2048);
    this._sun.shadow.camera.near = 0.5;
    this._sun.shadow.camera.far  = 1500;
    this._sun.shadow.camera.left = this._sun.shadow.camera.bottom = -400;
    this._sun.shadow.camera.right = this._sun.shadow.camera.top  =  400;
    this._scene.add(this._sun);

    // Post-processing
    this._composer = new EffectComposer(this._renderer);
    this._composer.addPass(new RenderPass(this._scene, this._camera));
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9, 0.55, 0.12
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
    if (planet.atmosphereColor) this._ambient.color.set(planet.atmosphereColor);

    // Day/night sun position based on planet type
    this._sun.color.set(planet.sunColor || 0xfff4e0);

    // Terrain
    this._terrain = new TerrainManager(this._scene, planet, this._sun);
    this._flora   = new FloraManager(this._scene, planet);
    this._creatures = new CreatureManager(this._scene, planet);
    this._mining  = new MiningSystem(this._scene, this._inventory);
    this._terrain.setManagers(this._flora, this._mining);

    // Planet atmosphere sky
    this._atmosphere = new PlanetAtmosphere(this._scene, planet);

    // Weather system
    this._weather = new WeatherSystem(this._scene, planet);

    // Space scene (hidden until leaving atmosphere)
    this._spaceScene = new SpaceScene(this._scene, this._galaxy);
    this._spaceScene.enterSystem(this._currentSystem);
    this._setSpaceVisible(false);
  }

  _teardownSurface() {
    if (this._terrain)   { this._terrain.dispose();    this._terrain   = null; }
    if (this._flora)     { this._flora.dispose();      this._flora     = null; }
    if (this._creatures) { this._creatures.dispose();  this._creatures = null; }
    if (this._mining)    { this._mining.dispose();     this._mining    = null; }
    if (this._atmosphere){ this._atmosphere.dispose(); this._atmosphere= null; }
    if (this._weather)   { this._weather.dispose();    this._weather   = null; }
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
      interact: false,
      mouseDX: 0, mouseDY: 0,
      // Ship
      shipThrust: 0, shipYaw: 0, shipPitch: 0, shipRoll: 0,
      // Joystick (touch)
      joyX: 0, joyY: 0,
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
      if (e.code === 'KeyG' && this._state === GS.PLANET_SURFACE) this._tryEnterShip();
      if (e.code === 'KeyG' && this._state === GS.SHIP_ATM)       this._tryExitShip();
      if (e.code === 'KeyP')          this._saveGame();
      if (e.code === 'KeyO')          this._loadGame();
    });

    document.addEventListener('keyup', e => { keys[e.code] = false; });

    // Pointer lock
    const canvas = document.getElementById('game-canvas');
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
      if (e.button === 0 && document.pointerLockElement === canvas) inp.mine = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) inp.mine = false;
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
      this._player.hp     = this._player.maxHp;
      this._player.shield = this._player.maxShield;
      this._player.lifeSup = 100;
      const sy = this._terrain ? this._terrain.getHeightAt(0, 0) : 5;
      this._player.setPosition(new THREE.Vector3(0, sy + 1, 0));
    }
    this._setState(GS.PLANET_SURFACE);
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
    s.classList.toggle('hidden');
  }

  _toggleGalaxyMap() {
    if (this.state === GS.GALAXY_MAP) {
      this._hud.hideGalaxyMap();
      this._setState(this._prevState);
    } else {
      this._prevState = this.state;
      this._setState(GS.GALAXY_MAP);
      this._hud.showGalaxyMap(this._galaxy, this._currentSystem?.id);
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
    this._hud.update(dt, this._player, this._currentPlanet, this._ship, this._terrain, gs);

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
    if (this._mining)    this._mining.update(dt, pos, inp.mine, null, this._terrain ? (x,z) => this._terrain.getHeightAt(x,z) : null);

    // Weather
    if (this._weather) {
      this._weather.update(dt, pos);
      this._hud.setWeather(this._weather.getWeatherName(), this._weather.getWindStrength());
    }

    // Player
    this._player.update(dt, inp, this._terrain, this._mining);

    // Ship idle
    this._ship?.update(dt, { shipThrust:0,shipYaw:0,shipPitch:0 }, this._terrain);

    // Creature combat – hostile creatures deal damage to player
    this._combatTimer += dt;
    if (this._combatTimer >= COMBAT_TICK_INTERVAL && this._creatures) {
      this._combatTimer = 0;
      const nearby = this._creatures.getNearbyCreatures(pos, 4);
      for (const cr of nearby) {
        if (cr.genome?.aggression === 'hostile' && cr.state === CREATURE_STATE.ATTACKING) {
          const dmg = cr.genome.bodySize * 8;
          const actual = this._player.applyDamage(dmg, 'creature');
          if (actual > 0) {
            this._hud.showNotification(`⚔ Attacked! −${Math.floor(actual)} HP`, 'warn', 1500);
          }
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

    // Player death
    if (!this._player.isAlive()) {
      this._setState(GS.DEAD);
      this._hud.showDeath();
    }

    // Day/night cycle
    this._updateDayNight(dt);

    // Auto-save every AUTO_SAVE_INTERVAL seconds
    this._autoSaveTimer += dt;
    if (this._autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this._autoSaveTimer = 0;
      this._saveGame(true);
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
    const cycle = 600; // seconds per full day
    const t  = (this._dayTime % cycle) / cycle;
    const sunAngle = t * Math.PI * 2;
    this._sun.position.set(Math.cos(sunAngle) * 500, Math.sin(sunAngle) * 500, 200);
    const dayFactor = Math.max(0, Math.sin(sunAngle));
    this._ambient.intensity = 0.15 + dayFactor * 0.4;
    this._sun.intensity     = 0.4  + dayFactor * 1.1;
    if (this._atmosphere) this._atmosphere.update(dt, this._sun.position.clone().normalize(), new THREE.Vector3());
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
  }

  // ─── Save / Load ─────────────────────────────────────────────────────────────
  _saveGame(silent = false) {
    try {
      const data = {
        version: 1,
        systemId: this._currentSystem?.id,
        planetSeed: this._currentPlanet?.seed,
        planetType: this._currentPlanet?.type,
        dayTime: this._dayTime || 0,
        player: this._player?.serializeState(),
        inventory: this._inventory?.serialize(),
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
      if (data.player && this._player) this._player.loadState(data.player);
      if (data.inventory && this._inventory) this._inventory.load(data.inventory);
      if (data.dayTime != null) this._dayTime = data.dayTime;
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
