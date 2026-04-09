/**
 * src/weather.js
 * Procedural weather system – rain, snow, sandstorm, blizzard, aurora, toxic fog.
 * Weather type is driven by planet.type and planet.stormFrequency.
 * Each weather event has particle effects, wind, and optional lightning flashes.
 */
import * as THREE from 'three';

const WEATHER_DEFS = {
  clear:     { particles: 0,    color: 0xffffff, size: 0.07, wind: 0.0, opacity: 0.6, name: 'Clear',       fallSpeed: 0 },
  rain:      { particles: 2000, color: 0x88aadd, size: 0.05, wind: 0.4, opacity: 0.5, name: 'Rain',        fallSpeed: 18 },
  storm:     { particles: 3500, color: 0x5577aa, size: 0.05, wind: 1.2, opacity: 0.6, name: 'Storm',       fallSpeed: 24, lightning: true },
  snow:      { particles: 1500, color: 0xddeeff, size: 0.15, wind: 0.2, opacity: 0.7, name: 'Snow',        fallSpeed: 3 },
  blizzard:  { particles: 3000, color: 0xaaccff, size: 0.12, wind: 2.0, opacity: 0.8, name: 'Blizzard',   fallSpeed: 6,  lightning: false },
  sandstorm: { particles: 3500, color: 0xcc9944, size: 0.09, wind: 3.5, opacity: 0.55, name: 'Sandstorm', fallSpeed: 1 },
  toxic_fog: { particles: 1200, color: 0x88cc44, size: 0.25, wind: 0.1, opacity: 0.25, name: 'Toxic Fog', fallSpeed: 0.5 },
  aurora:    { particles: 0,    color: 0x00ffcc, size: 0.0,  wind: 0.0, opacity: 0.0, name: 'Aurora',      fallSpeed: 0 },
};

const PLANET_WEATHER_TABLE = {
  LUSH:    ['clear', 'clear', 'clear', 'rain', 'rain', 'storm'],
  BARREN:  ['clear', 'clear', 'sandstorm', 'sandstorm', 'sandstorm'],
  TOXIC:   ['toxic_fog', 'toxic_fog', 'storm', 'clear', 'rain'],
  FROZEN:  ['clear', 'snow', 'snow', 'blizzard', 'blizzard', 'snow'],
  BURNING: ['clear', 'sandstorm', 'sandstorm', 'storm'],
  EXOTIC:  ['clear', 'aurora', 'aurora', 'rain', 'storm'],
  DEAD:    ['clear', 'clear', 'clear', 'sandstorm'],
  OCEAN:   ['clear', 'rain', 'rain', 'rain', 'storm', 'storm'],
};

export class WeatherSystem {
  constructor(scene, planet) {
    this.scene  = scene;
    this.planet = planet;

    this._current         = 'clear';
    this._transitionTimer = 0;
    this._changeInterval  = 60 + this._rng() * 120; // 60–180 s between changes
    this._particles       = null;
    this._lightningTimer  = 0;
    this._windTime        = 0;    // accumulated time for wind direction – deterministic
    this._windVec         = new THREE.Vector3();

    this._rng = this._makeRng(planet.seed || 1);

    // Build ambient light for lightning
    this._flashLight = new THREE.PointLight(0xffffff, 0, 500);
    this.scene.add(this._flashLight);
  }

  /** Current weather type string ('clear', 'rain', …) */
  get current() { return this._current; }

  /** Human-readable weather name */
  getWeatherName() {
    return WEATHER_DEFS[this._current]?.name || 'Clear';
  }

  /** Approximate horizontal wind magnitude (0–3.5) */
  getWindStrength() {
    return WEATHER_DEFS[this._current]?.wind || 0;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  _makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
  }

  _pickNextWeather() {
    const table = PLANET_WEATHER_TABLE[this.planet.type] || PLANET_WEATHER_TABLE.LUSH;
    const sf    = this.planet.stormFrequency || 0.3;
    // Bias toward stormy weather based on storm frequency
    if (this._rng() < sf * 0.5) {
      const stormy = table.filter(w => ['storm', 'blizzard', 'sandstorm'].includes(w));
      if (stormy.length) return stormy[Math.floor(this._rng() * stormy.length)];
    }
    return table[Math.floor(this._rng() * table.length)];
  }

  _applyWeather(type) {
    this._removeParticles();

    this._current = type;
    const def = WEATHER_DEFS[type];
    if (!def || def.particles === 0) return;

    const count  = def.particles;
    const spread = 100;
    const height = 45;

    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3    ] = (this._rng() - 0.5) * spread;
      positions[i * 3 + 1] = this._rng() * height;
      positions[i * 3 + 2] = (this._rng() - 0.5) * spread;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color:       def.color,
      size:        def.size,
      transparent: true,
      opacity:     def.opacity,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this._particles = new THREE.Points(geo, mat);
    this._particles._spread     = spread;
    this._particles._height     = height;
    this._particles._def        = def;
    this.scene.add(this._particles);

    // Reset lightning timer
    this._lightningTimer = 5 + this._rng() * 20;
  }

  _removeParticles() {
    if (this._particles) {
      this.scene.remove(this._particles);
      this._particles.geometry.dispose();
      this._particles.material.dispose();
      this._particles = null;
    }
  }

  _doLightningFlash() {
    // Quick double-flash
    this._flashLight.intensity = 8;
    setTimeout(() => { this._flashLight.intensity = 0; }, 50);
    setTimeout(() => { this._flashLight.intensity = 5; }, 100);
    setTimeout(() => { this._flashLight.intensity = 0; }, 160);
  }

  // ─── Public update (call every frame) ────────────────────────────────────────

  update(dt, playerPos) {
    // Weather change schedule
    this._transitionTimer += dt;
    if (this._transitionTimer >= this._changeInterval) {
      this._transitionTimer = 0;
      this._changeInterval  = 60 + this._rng() * 120;
      const next = this._pickNextWeather();
      if (next !== this._current) {
        this._applyWeather(next);
      }
    }

    if (!this._particles || !playerPos) return;

    const pts    = this._particles;
    const posAttr = pts.geometry.attributes.position;
    const def    = pts._def;
    const spread = pts._spread;
    const height = pts._height;
    const count  = posAttr.count;

    const fallSpeed = def.fallSpeed;
    const wind      = def.wind;

    // Wind direction rotates slowly using deterministic accumulated time
    this._windTime += dt * 0.05;
    this._windVec.set(wind * Math.cos(this._windTime), 0, wind * Math.sin(this._windTime));

    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      // Fall / drift
      y -= fallSpeed * dt;
      x += this._windVec.x * dt;
      z += this._windVec.z * dt;

      // Wrap – keep particles centred around player
      const px = playerPos.x;
      const pz = playerPos.z;
      const half = spread / 2;
      if (y < playerPos.y - 2)     y = playerPos.y + this._rng() * height;
      if (x - px > half)            x -= spread;
      else if (x - px < -half)      x += spread;
      if (z - pz > half)            z -= spread;
      else if (z - pz < -half)      z += spread;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    // Keep flash light near player
    this._flashLight.position.set(playerPos.x, playerPos.y + 30, playerPos.z);

    // Lightning
    if (def.lightning) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = 4 + this._rng() * 16;
        this._doLightningFlash();
      }
    }
  }

  dispose() {
    this._removeParticles();
    if (this._flashLight) {
      this.scene.remove(this._flashLight);
    }
  }
}
