/**
 * src/galaxy.js
 */
import * as THREE from 'three';

function seededRng(seed) {
  let s = seed;
  return function() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const STAR_NAMES = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta',
  'Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau','Upsilon',
  'Phi','Chi','Psi','Omega','Proxima','Kepler','Gliese','HD','Wolf','Ross'];
const PLANET_SUFFIXES = [' Prime',' Minor',' Major',' Secundus',' Tertius',' IV',' V'];
const ECONOMIES = ['Mining','Technology','Agricultural','Trading','Military','Scientific'];
const STAR_TYPES = [
  {type:'O', color:'#9bb0ff', size:3.5},
  {type:'B', color:'#aabfff', size:2.8},
  {type:'A', color:'#cad7ff', size:2.0},
  {type:'F', color:'#f8f7ff', size:1.5},
  {type:'G', color:'#fff4e8', size:1.0},
  {type:'K', color:'#ffd2a1', size:0.8},
  {type:'M', color:'#ffcc6f', size:0.6}
];

export class Galaxy {
  constructor(seed = 12345) {
    this.seed = seed;
    this._systems = null;
    this._generate();
  }

  _generate() {
    const rng = seededRng(this.seed);
    this._systems = [];
    for (let i = 0; i < 100; i++) {
      const r = seededRng(this.seed + i * 7919);
      const angle = r() * Math.PI * 2;
      const dist = Math.pow(r(), 0.5) * 800;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const starIdx = Math.floor(r() * STAR_TYPES.length);
      const st = STAR_TYPES[starIdx];
      const nameA = STAR_NAMES[Math.floor(r() * STAR_NAMES.length)];
      const nameB = STAR_NAMES[Math.floor(r() * STAR_NAMES.length)];
      const name = `${nameA}-${nameB} ${Math.floor(r()*900+100)}`;
      const planetCount = 3 + Math.floor(r() * 5);
      const planets = [];
      for (let p = 0; p < planetCount; p++) {
        const pr = seededRng(this.seed + i * 7919 + p * 1031);
        const types = ['LUSH','BARREN','TOXIC','FROZEN','BURNING','EXOTIC','DEAD','OCEAN'];
        const pname = STAR_NAMES[Math.floor(pr() * STAR_NAMES.length)] + PLANET_SUFFIXES[p % PLANET_SUFFIXES.length];
        planets.push({
          typeOverride: types[Math.floor(pr() * types.length)],
          orbitRadius: 300 + p * 250 + pr() * 100,
          seed: this.seed + i * 7919 + p * 1031
        });
      }
      this._systems.push({
        id: `sys_${i}`,
        name,
        position: { x, y },
        seed: this.seed + i * 7919,
        starType: st.type,
        starColor: st.color,
        starSize: st.size,
        economy: ECONOMIES[Math.floor(r() * ECONOMIES.length)],
        conflictLevel: Math.floor(r() * 5) + 1,
        visited: i === 0,
        planets
      });
    }
  }

  getSystems() { return this._systems; }
  getSystem(id) { return this._systems.find(s => s.id === id) || null; }

  getAdjacentSystems(id, count = 5) {
    const sys = this.getSystem(id);
    if (!sys) return [];
    return this._systems
      .filter(s => s.id !== id)
      .map(s => ({
        ...s,
        dist: Math.hypot(s.position.x - sys.position.x, s.position.y - sys.position.y)
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count);
  }
}

export class GalaxyMap {
  constructor(container, galaxy) {
    this.container = container;
    this.galaxy = galaxy;
    this.canvas = null;
    this.ctx2d = null;
    this.visible = false;
    this.currentSystemId = 'sys_0';
    this.selectedSystemId = null;
    this._onSelect = null;
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
    this._build();
  }

  _build() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.canvas.style.cssText = 'width:100%;height:100%;cursor:crosshair;';
    this.container.appendChild(this.canvas);
    this.ctx2d = this.canvas.getContext('2d');
    this.canvas.addEventListener('click', (e) => this._onClick(e));
  }

  _worldToScreen(wx, wy) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    return {
      x: cx + (wx + this._panX) * this._zoom,
      y: cy + (wy + this._panY) * this._zoom
    };
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
    let best = null, bestDist = 20;
    for (const sys of this.galaxy.getSystems()) {
      const sp = this._worldToScreen(sys.position.x, sys.position.y);
      const d = Math.hypot(sp.x - mx, sp.y - my);
      if (d < bestDist) { bestDist = d; best = sys; }
    }
    if (best) {
      this.selectedSystemId = best.id;
      this.update();
      if (this._onSelect) this._onSelect(best);
    }
  }

  show() { this.container.style.display = 'block'; this.visible = true; this.update(); }
  hide() { this.container.style.display = 'none'; this.visible = false; }

  update() {
    if (!this.visible || !this.ctx2d) return;
    const c = this.ctx2d;
    const W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#01030a';
    c.fillRect(0, 0, W, H);

    // Background stars
    c.fillStyle = 'rgba(255,255,255,0.3)';
    const rng = seededRng(99999);
    for (let i = 0; i < 300; i++) {
      c.fillRect(rng()*W, rng()*H, 1, 1);
    }

    const systems = this.galaxy.getSystems();
    const current = this.galaxy.getSystem(this.currentSystemId);

    // Warp range circle
    if (current) {
      const cp = this._worldToScreen(current.position.x, current.position.y);
      c.beginPath();
      c.arc(cp.x, cp.y, 150 * this._zoom, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(0,170,255,0.2)';
      c.lineWidth = 1;
      c.stroke();
    }

    // Draw systems
    for (const sys of systems) {
      const sp = this._worldToScreen(sys.position.x, sys.position.y);
      const r = (sys.starSize || 1) * 3 * this._zoom + 2;
      c.beginPath();
      c.arc(sp.x, sp.y, r, 0, Math.PI*2);
      const g = c.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r*2);
      g.addColorStop(0, sys.starColor);
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fill();
      if (sys.id === this.currentSystemId) {
        c.beginPath(); c.arc(sp.x, sp.y, r+4, 0, Math.PI*2);
        c.strokeStyle = '#0af'; c.lineWidth=1.5; c.stroke();
      }
      if (sys.id === this.selectedSystemId) {
        c.beginPath(); c.arc(sp.x, sp.y, r+7, 0, Math.PI*2);
        c.strokeStyle = '#ff0'; c.lineWidth=1.5; c.stroke();
        c.fillStyle = '#fff';
        c.font = `${Math.max(9, 11*this._zoom)}px "Share Tech Mono", monospace`;
        c.fillText(sys.name, sp.x+r+4, sp.y+4);
      }
    }
  }

  onSelectSystem(cb) { this._onSelect = cb; }
}
