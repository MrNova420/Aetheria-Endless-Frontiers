/**
 * src/ui.js
 * Full NMS-style HUD – built entirely with DOM elements (no canvas).
 * All elements created programmatically, styled via CSS classes.
 */

const RARITY_COLORS = {
  common: '#aaaaaa', uncommon: '#4caf50', rare: '#2196f3',
  epic: '#9c27b0', legendary: '#ffd700', mythic: '#ff6600',
};

// ─── Tiny DOM helpers ─────────────────────────────────────────────────────────
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}
function svgEl(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// ─── SVG arc helpers ──────────────────────────────────────────────────────────
function describeArc(cx, cy, r, startAngle, endAngle) {
  const toRad = a => (a - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// ─── GameHUD ──────────────────────────────────────────────────────────────────
export class GameHUD {
  constructor() {
    this._el      = {};
    this._notifQ  = [];
    this._notifT  = 0;
    this._state   = 'surface'; // 'surface' | 'ship' | 'space'
  }

  init() {
    this._buildLoadingScreen();
    this._buildMainMenu();
    this._buildHUD();
    this._buildInventoryScreen();
    this._buildCraftingScreen();
    this._buildTechScreen();
    this._buildGalaxyMapScreen();
    this._buildPauseScreen();
    this._buildDeathScreen();
    this._bindMenuButtons();
  }

  // ─── Loading Screen ─────────────────────────────────────────────────────────
  _buildLoadingScreen() {
    // Already in index.html; just reference it
    this._el.loading   = document.getElementById('loading-screen');
    this._el.loadBar   = document.getElementById('loading-bar');
    this._el.loadMsg   = document.getElementById('loading-msg');
  }

  setLoadingProgress(pct, msg) {
    if (this._el.loadBar) this._el.loadBar.style.width = pct + '%';
    if (this._el.loadMsg && msg) this._el.loadMsg.textContent = msg;
  }

  hideLoading() {
    if (this._el.loading) {
      this._el.loading.style.opacity = '0';
      this._el.loading.style.transition = 'opacity 0.6s';
      setTimeout(() => { if (this._el.loading) this._el.loading.style.display = 'none'; }, 650);
    }
  }

  // ─── Main Menu ──────────────────────────────────────────────────────────────
  _buildMainMenu() {
    this._el.mainMenu = document.getElementById('main-menu');
    const btnNew = document.getElementById('btn-new-game');
    if (btnNew) btnNew.addEventListener('click', () => this._onNewGame());
    const btnCtrl = document.getElementById('btn-controls');
    if (btnCtrl) btnCtrl.addEventListener('click', () => this._toggleControls());
    const btnBack = document.getElementById('btn-back-ctrl');
    if (btnBack) btnBack.addEventListener('click', () => this._toggleControls(false));
  }

  showMainMenu() {
    if (this._el.mainMenu) this._el.mainMenu.classList.remove('hidden');
  }
  hideMainMenu() {
    if (this._el.mainMenu) this._el.mainMenu.classList.add('hidden');
  }

  _onNewGame() {
    const cs = document.getElementById('class-select');
    const mb = document.getElementById('main-buttons');
    if (cs && mb) { cs.classList.remove('hidden'); mb.classList.add('hidden'); }
  }

  _toggleControls(show) {
    const cp = document.getElementById('controls-panel');
    const mb = document.getElementById('main-buttons');
    if (!cp || !mb) return;
    const visible = show !== undefined ? show : cp.classList.contains('hidden');
    if (visible) { cp.classList.remove('hidden'); mb.classList.add('hidden'); }
    else          { cp.classList.add('hidden');    mb.classList.remove('hidden'); }
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────
  _buildHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;

    // ── Vitals (bottom-left) ──────────────────────────────────────────────────
    const vitals = el('div', 'hud-vitals');

    // Health arc
    const hpWrap = el('div', 'vital-wrap');
    const hpSvg  = this._buildArcSVG('hp-arc', '#0f8', '#09553a');
    hpWrap.appendChild(hpSvg);
    const hpLbl = el('div', 'vital-label');
    this._el.hpVal = el('span', 'vital-val', '100');
    this._el.hpMax = el('span', 'vital-sub', '/100');
    const hpIco = el('span', 'vital-icon', '❤');
    hpLbl.append(hpIco, this._el.hpVal, this._el.hpMax);
    hpWrap.appendChild(hpLbl);
    vitals.appendChild(hpWrap);

    // Shield arc
    const shWrap = el('div', 'vital-wrap');
    const shSvg  = this._buildArcSVG('sh-arc', '#4af', '#1a3a55');
    shWrap.appendChild(shSvg);
    const shLbl = el('div', 'vital-label');
    this._el.shVal = el('span', 'vital-val', '80');
    this._el.shMax = el('span', 'vital-sub', '/80');
    const shIco = el('span', 'vital-icon', '🛡');
    shLbl.append(shIco, this._el.shVal, this._el.shMax);
    shWrap.appendChild(shLbl);
    vitals.appendChild(shWrap);

    // Jetpack bar
    const jpWrap = el('div', 'jetpack-wrap');
    const jpLbl  = el('div', 'jp-label', '⚡ JETPACK');
    const jpBar  = el('div', 'jp-bar-outer');
    this._el.jpInner = el('div', 'jp-bar-inner');
    jpBar.appendChild(this._el.jpInner);
    jpWrap.append(jpLbl, jpBar);
    vitals.appendChild(jpWrap);

    hud.appendChild(vitals);

    // ── Top hazard/life-support bars ──────────────────────────────────────────
    const hazard = el('div', 'hazard-bars');
    const lsRow  = el('div', 'hazard-row');
    lsRow.appendChild(el('span', 'hazard-icon', '🌬'));
    lsRow.appendChild(el('span', 'hazard-lbl', 'LIFE SUPPORT'));
    const lsBar  = el('div', 'hazard-bar-outer');
    this._el.lsBar = el('div', 'hazard-bar-inner ls-bar');
    lsBar.appendChild(this._el.lsBar);
    lsRow.appendChild(lsBar);
    hazard.appendChild(lsRow);

    const hzRow  = el('div', 'hazard-row');
    hzRow.appendChild(el('span', 'hazard-icon', '☢'));
    hzRow.appendChild(el('span', 'hazard-lbl', 'HAZARD'));
    const hzBar  = el('div', 'hazard-bar-outer');
    this._el.hzBar = el('div', 'hazard-bar-inner hz-bar');
    hzBar.appendChild(this._el.hzBar);
    hzRow.appendChild(hzBar);
    hazard.appendChild(hzRow);
    hud.appendChild(hazard);

    // ── Planet / Location (top-left) ─────────────────────────────────────────
    const loc = el('div', 'hud-location');
    this._el.locPlanet = el('span', 'loc-planet', 'Loading…');
    this._el.locBiome  = el('span', 'loc-biome', '');
    this._el.locCoords = el('span', 'loc-coords', '');
    loc.append(this._el.locPlanet, this._el.locBiome, this._el.locCoords);
    hud.appendChild(loc);

    // ── Level / XP (top-right) ────────────────────────────────────────────────
    const lvl = el('div', 'hud-level');
    this._el.lvlNum = el('span', 'level-num', 'Lv 1');
    const xpWrap = el('div', 'xp-bar-wrap');
    this._el.xpBar = el('div', 'xp-bar');
    xpWrap.appendChild(this._el.xpBar);
    this._el.xpTxt = el('span', 'xp-txt', '0 / 100 XP');
    lvl.append(this._el.lvlNum, xpWrap, this._el.xpTxt);
    hud.appendChild(lvl);

    // ── Compass (top-centre) ──────────────────────────────────────────────────
    const compass = el('div', 'hud-compass');
    this._el.compass = compass;
    const compassInner = el('div', 'compass-inner');
    this._el.compassInner = compassInner;
    for (const dir of ['N','NE','E','SE','S','SW','W','NW','N']) {
      const d = el('span', 'compass-dir', dir);
      compassInner.appendChild(d);
    }
    const compassNeedle = el('div', 'compass-needle', '▾');
    compass.append(compassInner, compassNeedle);
    hud.appendChild(compass);

    // ── Crosshair ─────────────────────────────────────────────────────────────
    const xh = el('div', 'crosshair');
    xh.innerHTML = '<div class="ch-h"></div><div class="ch-v"></div>';
    hud.appendChild(xh);
    this._el.crosshair = xh;

    // ── Interaction prompt ────────────────────────────────────────────────────
    this._el.interact = el('div', 'interact-prompt hidden', '');
    hud.appendChild(this._el.interact);

    // ── Mining progress ring ──────────────────────────────────────────────────
    this._el.miningRing = el('div', 'mining-ring hidden');
    const mr = this._buildArcSVG('mining-arc', '#f80', '#552200');
    mr.setAttribute('width', '80'); mr.setAttribute('height', '80');
    this._el.miningRing.appendChild(mr);
    hud.appendChild(this._el.miningRing);
    this._el.miningArc = mr;

    // ── Notification feed ─────────────────────────────────────────────────────
    this._el.notifs = el('div', 'notifications');
    hud.appendChild(this._el.notifs);

    // ── Boss bar ──────────────────────────────────────────────────────────────
    const bossBar = el('div', 'boss-bar hidden');
    this._el.bossName = el('div', 'boss-name', 'BOSS');
    const bossOuter = el('div', 'boss-bar-outer');
    this._el.bossFill = el('div', 'boss-bar-fill');
    bossOuter.appendChild(this._el.bossFill);
    bossBar.append(this._el.bossName, bossOuter);
    hud.appendChild(bossBar);
    this._el.bossBar = bossBar;

    // ── Damage numbers layer ──────────────────────────────────────────────────
    this._el.dmgLayer = el('div', 'dmg-layer');
    hud.appendChild(this._el.dmgLayer);

    // ── Minimap ───────────────────────────────────────────────────────────────
    const mmWrap  = el('div', 'minimap-wrap');
    this._el.minimap = document.createElement('canvas');
    this._el.minimap.width  = 160;
    this._el.minimap.height = 160;
    this._el.minimap.className = 'minimap';
    this._el.mmCtx = this._el.minimap.getContext('2d');
    mmWrap.appendChild(this._el.minimap);
    hud.appendChild(mmWrap);

    // ── Flight controls indicator (shown in ship mode) ────────────────────────
    this._el.flightHud = el('div', 'flight-hud hidden');
    this._el.speedVal  = el('span', 'flight-stat', '0');
    this._el.altVal    = el('span', 'flight-stat', '0');
    const fRow1 = el('div', 'flight-row');
    fRow1.append(el('span', 'flight-lbl', 'SPD'), this._el.speedVal);
    const fRow2 = el('div', 'flight-row');
    fRow2.append(el('span', 'flight-lbl', 'ALT'), this._el.altVal);
    this._el.flightHud.append(fRow1, fRow2);
    hud.appendChild(this._el.flightHud);

    // ── Quick-slot bar (bottom) ───────────────────────────────────────────────
    const qbar = el('div', 'quick-bar');
    this._el.qslots = [];
    for (let i = 0; i < 10; i++) {
      const slot = el('div', 'q-slot');
      const icon = el('div', 'q-icon', '');
      const key  = el('div', 'q-key', String(i + 1));
      const qty  = el('div', 'q-qty', '');
      slot.append(icon, key, qty);
      qbar.appendChild(slot);
      this._el.qslots.push({ slot, icon, qty });
    }
    hud.appendChild(qbar);

    // ── Scanning ring ─────────────────────────────────────────────────────────
    this._el.scanRing = el('div', 'scan-ring hidden');
    hud.appendChild(this._el.scanRing);
  }

  _buildArcSVG(id, strokeColor, trackColor) {
    const svg  = svgEl('svg', { viewBox: '0 0 80 80', width: '80', height: '80' });
    const bg   = svgEl('path', {
      d: describeArc(40, 40, 33, -140, 140),
      stroke: trackColor, 'stroke-width': '6',
      fill: 'none', 'stroke-linecap': 'round'
    });
    const arc  = svgEl('path', {
      id, d: describeArc(40, 40, 33, -140, 140),
      stroke: strokeColor, 'stroke-width': '6',
      fill: 'none', 'stroke-linecap': 'round',
      style: `transition:stroke-dashoffset 0.25s; filter:drop-shadow(0 0 4px ${strokeColor})`
    });
    // Use stroke-dasharray trick for fill %
    const perim = Math.PI * 2 * 33 * (280 / 360);
    arc.setAttribute('stroke-dasharray', String(perim));
    arc.setAttribute('stroke-dashoffset', '0');
    arc._perim = perim;
    svg.append(bg, arc);
    svg._arc = arc;
    return svg;
  }

  _setArcFill(svg, pct) {
    const arc = svg._arc;
    if (!arc) return;
    const off = arc._perim * (1 - Math.max(0, Math.min(1, pct)));
    arc.setAttribute('stroke-dashoffset', String(off));
  }

  // ─── Inventory Screen ────────────────────────────────────────────────────────
  _buildInventoryScreen() {
    this._el.invScreen = document.getElementById('inventory-screen');
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    this._el.invGrid = grid;
    // Close button
    const btn = document.getElementById('btn-close-inv');
    if (btn) btn.addEventListener('click', () => this.hideInventoryScreen());
  }

  showInventoryScreen(inventory) {
    if (!this._el.invScreen) return;
    this._el.invScreen.classList.remove('hidden');
    this._renderInventoryGrid(inventory);
  }

  hideInventoryScreen() {
    if (this._el.invScreen) this._el.invScreen.classList.add('hidden');
  }

  _renderInventoryGrid(inventory) {
    const grid = this._el.invGrid;
    if (!grid || !inventory) return;
    grid.innerHTML = '';
    const slots = inventory.getSlots();
    for (const slot of slots) {
      const cell = el('div', `inv-cell ${slot ? (slot.rarity || 'common') : 'empty'}`);
      if (slot) {
        const icon = el('span', 'inv-icon', slot.icon || '📦');
        const name = el('div', 'inv-name', slot.type);
        const qty  = el('div', 'inv-qty', `×${slot.amount}`);
        name.style.color = RARITY_COLORS[slot.rarity] || '#aaa';
        cell.append(icon, name, qty);
        cell.title = `${slot.type}\nAmount: ${slot.amount}`;
      }
      grid.appendChild(cell);
    }
  }

  // ─── Crafting Screen ─────────────────────────────────────────────────────────
  _buildCraftingScreen() {
    this._el.craftScreen = el('div', 'screen-overlay hidden');
    this._el.craftScreen.id = 'craft-screen';
    const panel = el('div', 'screen-panel');
    const title = el('h2', '', 'CRAFTING');
    const list  = el('div', 'craft-list');
    this._el.craftList = list;
    const closeBtn = el('button', 'mm-btn', 'CLOSE (N)');
    closeBtn.addEventListener('click', () => this.hideCraftingMenu());
    panel.append(title, list, closeBtn);
    this._el.craftScreen.appendChild(panel);
    document.body.appendChild(this._el.craftScreen);
  }

  showCraftingMenu(crafting, inventory) {
    this._el.craftScreen.classList.remove('hidden');
    this._renderCraftingList(crafting, inventory);
  }

  hideCraftingMenu() {
    this._el.craftScreen.classList.add('hidden');
  }

  _renderCraftingList(crafting, inventory) {
    const list = this._el.craftList;
    if (!list) return;
    list.innerHTML = '';
    const recipes = crafting.getAvailableRecipes();
    for (const r of recipes) {
      const row     = el('div', 'craft-row');
      const can     = crafting.canCraft(r.id);
      const nameEl  = el('div', 'craft-name', r.name);
      nameEl.style.color = can ? '#0f8' : '#888';
      const inEl    = el('div', 'craft-inputs');
      for (const [type, amt] of Object.entries(r.inputs)) {
        const have = inventory ? inventory.getAmount(type) : 0;
        const s    = el('span', `craft-ing ${have >= amt ? 'ok' : 'missing'}`, `${type} ×${amt}`);
        inEl.appendChild(s);
      }
      const btn = el('button', `mm-btn craft-btn ${can ? 'primary' : ''}`, 'CRAFT');
      btn.disabled = !can;
      btn.addEventListener('click', () => {
        const ok = crafting.craft(r.id);
        if (ok) { this.showNotification(`Crafted: ${r.name}`, 'success'); this._renderCraftingList(crafting, inventory); }
      });
      row.append(nameEl, inEl, btn);
      list.appendChild(row);
    }
  }

  // ─── Tech Screen ─────────────────────────────────────────────────────────────
  _buildTechScreen() {
    this._el.techScreen = el('div', 'screen-overlay hidden');
    this._el.techScreen.id = 'tech-screen';
    const panel = el('div', 'screen-panel');
    const title = el('h2', '', 'TECHNOLOGY');
    this._el.techContent = el('div', 'tech-content');
    const closeBtn = el('button', 'mm-btn', 'CLOSE (T)');
    closeBtn.addEventListener('click', () => this.hideTechScreen());
    panel.append(title, this._el.techContent, closeBtn);
    this._el.techScreen.appendChild(panel);
    document.body.appendChild(this._el.techScreen);
  }

  showTechScreen(techTree, inventory) {
    this._el.techScreen.classList.remove('hidden');
    this._renderTechTree(techTree, inventory);
  }

  hideTechScreen() { this._el.techScreen.classList.add('hidden'); }

  _renderTechTree(techTree, inventory) {
    const cont = this._el.techContent;
    if (!cont || !techTree) return;
    cont.innerHTML = '';
    for (const [cat, items] of Object.entries(techTree.tree)) {
      const catEl = el('div', 'tech-cat');
      catEl.appendChild(el('h3', 'tech-cat-name', cat));
      for (const [id, tech] of Object.entries(items)) {
        const row = el('div', 'tech-row');
        const unlocked = techTree.isUnlocked(cat, id);
        const nameEl = el('span', `tech-name ${unlocked ? 'unlocked' : ''}`, tech.name);
        row.appendChild(nameEl);
        if (!unlocked) {
          const btn = el('button', 'mm-btn tech-btn', 'UPGRADE');
          const canAfford = techTree.canAfford(cat, id, inventory);
          btn.disabled = !canAfford;
          btn.addEventListener('click', () => {
            if (techTree.upgrade(cat, id, inventory)) {
              this.showNotification(`Upgraded: ${tech.name}`, 'upgrade');
              this._renderTechTree(techTree, inventory);
            }
          });
          row.appendChild(btn);
        } else {
          row.appendChild(el('span', 'tech-done', '✔ INSTALLED'));
        }
        catEl.appendChild(row);
      }
      cont.appendChild(catEl);
    }
  }

  // ─── Galaxy Map Screen ────────────────────────────────────────────────────────
  _buildGalaxyMapScreen() {
    this._el.galaxyScreen = el('div', 'screen-overlay hidden');
    this._el.galaxyScreen.id = 'galaxy-screen';
    const panel = el('div', 'screen-panel galaxy-panel');
    const title = el('h2', '', 'GALAXY MAP');
    this._el.galaxyCanvas = el('canvas', 'galaxy-canvas');
    this._el.galaxyCanvas.width  = 700;
    this._el.galaxyCanvas.height = 500;
    const closeBtn = el('button', 'mm-btn', 'CLOSE (M)');
    closeBtn.addEventListener('click', () => this.hideGalaxyMap());
    panel.append(title, this._el.galaxyCanvas, closeBtn);
    this._el.galaxyScreen.appendChild(panel);
    document.body.appendChild(this._el.galaxyScreen);
  }

  showGalaxyMap(galaxy, currentSystemId) {
    this._el.galaxyScreen.classList.remove('hidden');
    this._renderGalaxyCanvas(galaxy, currentSystemId);
  }

  hideGalaxyMap() { this._el.galaxyScreen.classList.add('hidden'); }

  _renderGalaxyCanvas(galaxy, currentId) {
    const canvas = this._el.galaxyCanvas;
    if (!canvas || !galaxy) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#030818';
    ctx.fillRect(0, 0, w, h);

    const systems = galaxy.getSystems();
    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of systems) { minX=Math.min(minX,s.x); maxX=Math.max(maxX,s.x); minY=Math.min(minY,s.y); maxY=Math.max(maxY,s.y); }
    const toScreen = (gx, gy) => ({
      sx: ((gx - minX) / (maxX - minX + 0.001)) * (w - 40) + 20,
      sy: ((gy - minY) / (maxY - minY + 0.001)) * (h - 40) + 20,
    });

    // Draw systems
    for (const sys of systems) {
      const { sx, sy } = toScreen(sys.x, sys.y);
      const isCurrent = sys.id === currentId;
      ctx.beginPath();
      ctx.arc(sx, sy, isCurrent ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? '#0af' : (sys.starType?.color || '#fff');
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0af';
        ctx.font = '10px Share Tech Mono, monospace';
        ctx.fillText(sys.name, sx + 8, sy - 8);
      }
    }
    // Warp range circle
    const cur = systems.find(s => s.id === currentId);
    if (cur) {
      const { sx, sy } = toScreen(cur.x, cur.y);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0,170,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ─── Pause Screen ─────────────────────────────────────────────────────────────
  _buildPauseScreen() {
    this._el.pauseScreen = document.getElementById('pause-menu');
    const resume = document.getElementById('btn-resume');
    if (resume) resume.addEventListener('click', () => window.game && window.game.resume());
    const mmBtn = document.getElementById('btn-main-menu-from-pause');
    if (mmBtn) mmBtn.addEventListener('click', () => window.game && window.game.goToMainMenu());
  }

  showPause() { if (this._el.pauseScreen) this._el.pauseScreen.classList.remove('hidden'); }
  hidePause() { if (this._el.pauseScreen) this._el.pauseScreen.classList.add('hidden'); }

  // ─── Death Screen ─────────────────────────────────────────────────────────────
  _buildDeathScreen() {
    this._el.deathScreen = el('div', 'screen-overlay hidden death-screen');
    this._el.deathScreen.id = 'death-screen';
    const panel = el('div', 'screen-panel death-panel');
    panel.appendChild(el('h2', 'death-title', 'YOU DIED'));
    panel.appendChild(el('p', 'death-msg', 'All discoveries preserved. Inventory dropped at death site.'));
    const respawn = el('button', 'mm-btn primary', 'RESPAWN');
    respawn.addEventListener('click', () => window.game && window.game.respawn());
    panel.appendChild(respawn);
    this._el.deathScreen.appendChild(panel);
    document.body.appendChild(this._el.deathScreen);
  }

  showDeath() { this._el.deathScreen.classList.remove('hidden'); }
  hideDeath() { this._el.deathScreen.classList.add('hidden'); }

  // ─── Bind menu buttons ────────────────────────────────────────────────────────
  _bindMenuButtons() {}

  // ─── Main update ──────────────────────────────────────────────────────────────
  update(dt, player, planet, ship, terrain, gameState) {
    if (!player) return;
    const stats = player.getStats();

    // Health arc
    const hpSvg = document.querySelector('#hud .vital-wrap:nth-child(1) svg');
    if (hpSvg?._arc) this._setArcFill(hpSvg, stats.hp / stats.maxHp);
    if (this._el.hpVal) this._el.hpVal.textContent = stats.hp;
    if (this._el.hpMax) this._el.hpMax.textContent = '/' + stats.maxHp;

    // Shield arc
    const shSvg = document.querySelector('#hud .vital-wrap:nth-child(2) svg');
    if (shSvg?._arc) this._setArcFill(shSvg, stats.shield / stats.maxShield);
    if (this._el.shVal) this._el.shVal.textContent = stats.shield;

    // Jetpack bar
    if (this._el.jpInner) this._el.jpInner.style.height = (stats.jetpack / stats.maxJetpack * 100) + '%';

    // Life support
    if (this._el.lsBar) this._el.lsBar.style.width = stats.lifeSup + '%';

    // Hazard (if planet has hazard)
    if (planet && this._el.hzBar) {
      const hz = Math.max(0, (planet.toxicity || 0) + (planet.radiation || 0)) * 50;
      this._el.hzBar.style.width = Math.min(100, hz) + '%';
    }

    // Location
    if (planet && this._el.locPlanet) {
      this._el.locPlanet.textContent = planet.name || 'Unknown Planet';
    }
    const pos = player.getPosition();
    if (this._el.locCoords) {
      this._el.locCoords.textContent = `${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}`;
    }

    // Compass (yaw from camera)
    if (this._el.compassInner) {
      const yawDeg = ((player._camYaw || 0) * 180 / Math.PI) % 360;
      this._el.compassInner.style.transform = `translateX(${yawDeg * 0.5}px)`;
    }

    // Flight HUD (ship mode)
    if (gameState === 'ship' || gameState === 'space') {
      if (this._el.flightHud) this._el.flightHud.classList.remove('hidden');
      if (ship) {
        const vel = ship._vel || { length: () => 0 };
        if (this._el.speedVal) this._el.speedVal.textContent = (typeof vel.length === 'function' ? vel.length() : 0).toFixed(0) + ' m/s';
        if (this._el.altVal)   this._el.altVal.textContent   = (ship.getPosition().y).toFixed(0) + ' m';
      }
    } else {
      if (this._el.flightHud) this._el.flightHud.classList.add('hidden');
    }

    // Mining ring
    if (player.isMining) {
      if (this._el.miningRing) this._el.miningRing.classList.remove('hidden');
    } else {
      if (this._el.miningRing) this._el.miningRing.classList.add('hidden');
    }

    // Scan ring
    if (player.isScanning) {
      if (this._el.scanRing) this._el.scanRing.classList.remove('hidden');
    } else {
      if (this._el.scanRing) this._el.scanRing.classList.add('hidden');
    }

    // Minimap
    this._updateMinimap(pos, terrain);

    // Notification drain
    this._notifT -= dt;
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────────
  _updateMinimap(playerPos, terrain) {
    const ctx = this._el.mmCtx;
    if (!ctx) return;
    const w = 160, h = 160, range = 300;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,8,20,0.85)';
    ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();

    // Terrain height sample grid
    if (terrain) {
      const step = range / 20;
      for (let dx = -10; dx <= 10; dx++) {
        for (let dz = -10; dz <= 10; dz++) {
          const wx = playerPos.x + dx * step;
          const wz = playerPos.z + dz * step;
          const sy = terrain.getHeightAt(wx, wz);
          const nx = (dx + 10) / 20 * w;
          const ny = (dz + 10) / 20 * h;
          const bright = Math.min(1, sy / 50);
          ctx.fillStyle = `rgba(0,${Math.floor(bright*120+40)},${Math.floor(bright*80+30)},0.7)`;
          ctx.fillRect(nx - 4, ny - 4, 8, 8);
        }
      }
    }

    // Player dot
    ctx.fillStyle = '#0af';
    ctx.beginPath(); ctx.arc(w/2, h/2, 4, 0, Math.PI*2); ctx.fill();

    // Circle mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); ctx.arc(w/2, h/2, w/2-1, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Border
    ctx.strokeStyle = 'rgba(0,170,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w/2, h/2, w/2-1, 0, Math.PI*2); ctx.stroke();
  }

  // ─── Notifications ────────────────────────────────────────────────────────────
  showNotification(text, type = 'info', duration = 3000) {
    if (!this._el.notifs) return;
    const n = el('div', `notif notif-${type}`, text);
    this._el.notifs.appendChild(n);
    setTimeout(() => n.remove(), duration);
  }

  // ─── Damage numbers ───────────────────────────────────────────────────────────
  showDamageNumber(screenX, screenY, amount, type = 'enemy') {
    const layer = this._el.dmgLayer;
    if (!layer) return;
    const d = el('span', `dmg-num ${type}`, String(Math.floor(amount)));
    d.style.left = screenX + 'px';
    d.style.top  = screenY + 'px';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  // ─── Boss bar ─────────────────────────────────────────────────────────────────
  showBossBar(name, pct) {
    if (this._el.bossBar)  this._el.bossBar.classList.remove('hidden');
    if (this._el.bossName) this._el.bossName.textContent = name;
    if (this._el.bossFill) this._el.bossFill.style.width = (pct * 100) + '%';
  }
  hideBossBar() {
    if (this._el.bossBar) this._el.bossBar.classList.add('hidden');
  }

  // ─── Interaction prompt ───────────────────────────────────────────────────────
  showInteractionPrompt(text) {
    if (this._el.interact) { this._el.interact.textContent = text; this._el.interact.classList.remove('hidden'); }
  }
  hideInteractionPrompt() {
    if (this._el.interact) this._el.interact.classList.add('hidden');
  }

  // ─── Analysis popup ───────────────────────────────────────────────────────────
  showAnalysis(entity) {
    this.showNotification(`📡 ${entity.name || 'Unknown Entity'} – SCANNED`, 'scan', 4000);
  }

  // ─── HUD visibility ───────────────────────────────────────────────────────────
  showHUD() {
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
  }
  hideHUD() {
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('hidden');
  }

  setGameState(state) {
    this._state = state;
  }

  dispose() {}
}
