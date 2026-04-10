/**
 * src/ui.js
 * Full NMS-style HUD – built entirely with DOM elements (no canvas).
 * All elements created programmatically, styled via CSS classes.
 */

const RARITY_COLORS = {
  common: '#aaaaaa', uncommon: '#4caf50', rare: '#2196f3',
  epic: '#9c27b0', legendary: '#ffd700', mythic: '#ff6600',
};

const WIND_DISPLAY_THRESHOLD = 1.5;  // m/s – show wind speed label above this strength
const PULSE_BASE              = 0.03; // minimum vignette opacity base
const PULSE_SPEED             = 2.0;  // radians/sec for vignette pulse sine wave
const PULSE_AMPLITUDE         = 0.07; // max additional opacity from pulse

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
    this._elapsed = 0;         // accumulated game time for frame-rate-independent effects
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
    // Inject lore tips
    this._startLoreTips();
  }

  _startLoreTips() {
    const TIPS = [
      '💡 Hold SHIFT to sprint across alien terrain.',
      '⚡ Jetpack fuel regenerates automatically when grounded.',
      '🔍 Press F to scan your surroundings for resources and fauna.',
      '⚙ Press B to deploy an Auto-Extractor near a resource node.',
      '💊 Craft Medkits from Sodium + Oxygen and use them with number keys.',
      '🛡 Shield Battery restores 60 shield — craft with Copper + Cobalt.',
      '🌌 Explore different planet biomes for unique resources and creatures.',
      '☠ Alpha creatures drop rare materials — approach with caution!',
      '📜 Complete quests for XP and bonus resources to progress faster.',
      '🚀 Collect Warp Cells to travel between star systems.',
    ];
    let tipIdx = 0;
    const loadMsg = document.getElementById('loading-msg');
    if (!loadMsg) return;
    // Create tip element below loading-msg
    const tipEl = document.createElement('div');
    tipEl.id = 'loading-tip';
    tipEl.style.cssText = 'color:#88ccff;font-size:0.8rem;margin-top:10px;opacity:0.85;transition:opacity 0.5s;max-width:340px;text-align:center;';
    tipEl.textContent = TIPS[0];
    loadMsg.parentNode?.insertBefore(tipEl, loadMsg.nextSibling);
    this._loreTipInterval = setInterval(() => {
      tipEl.style.opacity = '0';
      setTimeout(() => {
        tipIdx = (tipIdx + 1) % TIPS.length;
        tipEl.textContent = TIPS[tipIdx];
        tipEl.style.opacity = '0.85';
      }, 500);
    }, 3500);
  }

  setLoadingProgress(pct, msg) {
    if (this._el.loadBar) this._el.loadBar.style.width = pct + '%';
    if (this._el.loadMsg && msg) this._el.loadMsg.textContent = msg;
  }

  hideLoading() {
    if (this._loreTipInterval) { clearInterval(this._loreTipInterval); this._loreTipInterval = null; }
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

    // Weather row
    const wxRow = el('div', 'hazard-row');
    wxRow.appendChild(el('span', 'hazard-icon', '🌤'));
    wxRow.appendChild(el('span', 'hazard-lbl', 'WEATHER'));
    this._el.weatherLbl  = el('span', 'hazard-weather', 'Clear');
    wxRow.appendChild(this._el.weatherLbl);
    hazard.appendChild(wxRow);

    hud.appendChild(hazard);

    // ── Planet / Location (top-left) ─────────────────────────────────────────
    const loc = el('div', 'hud-location');
    this._el.locPlanet = el('span', 'loc-planet', 'Loading…');
    this._el.locBiome  = el('span', 'loc-biome', '');
    this._el.locCoords = el('span', 'loc-coords', '');
    loc.append(this._el.locPlanet, this._el.locBiome, this._el.locCoords);
    hud.appendChild(loc);

    // ── Level / XP (top-right) ────────────────────────────────────────────────
    const lvl = el('div', 'hud-level-box');
    this._el.lvlNum  = el('span', 'lvl-num',   'Lv 1');
    this._el.lvlLbl  = el('span', 'lvl-label', 'EXPLORER');
    const xpBg  = el('div', 'xp-bar-bg');
    this._el.xpFill = el('div', 'xp-bar-fill');
    this._el.xpFill.style.width = '0%';
    xpBg.appendChild(this._el.xpFill);
    this._el.xpTxt = el('span', 'lvl-label', '0 / 100 XP');
    lvl.append(this._el.lvlNum, this._el.lvlLbl, xpBg, this._el.xpTxt);
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

    // ── Danger vignette (low HP) ──────────────────────────────────────────────
    this._el.dangerVignette = el('div', 'danger-vignette');
    document.body.appendChild(this._el.dangerVignette);

    // ── Damage flash overlay ──────────────────────────────────────────────────
    this._el.damageFlash = el('div', 'damage-flash');
    document.body.appendChild(this._el.damageFlash);

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
      const slot = el('div', 'quick-slot');
      const icon = el('div', 'q-icon', '');
      const key  = el('div', 'q-key', i === 9 ? '0' : String(i + 1));
      const qty  = el('div', 'q-qty', '');
      slot.append(icon, key, qty);
      qbar.appendChild(slot);
      this._el.qslots.push({ slot, icon, qty });
    }
    hud.appendChild(qbar);

    // ── Hazard vignette (full-screen overlay for environmental effects) ───────
    this._el.vignette = el('div', 'hazard-vignette');
    hud.appendChild(this._el.vignette);

    // ── Scan results panel ────────────────────────────────────────────────────
    this._el.scanPanel = el('div', 'scan-panel hidden');
    hud.appendChild(this._el.scanPanel);

    // ── Scanning ring ─────────────────────────────────────────────────────────
    this._el.scanRing = el('div', 'scan-ring hidden');
    hud.appendChild(this._el.scanRing);

    // ── Status effects row ────────────────────────────────────────────────────
    this._el.statusRow = el('div', 'status-row');
    hud.appendChild(this._el.statusRow);

    // ── Quest tracker (top-right overlay) ─────────────────────────────────────
    this._el.questTracker = el('div', 'quest-tracker hidden');
    this._el.questTitle   = el('div', 'quest-title', '');
    this._el.questObj     = el('div', 'quest-obj',   '');
    this._el.questBar     = el('div', 'quest-bar-outer');
    this._el.questFill    = el('div', 'quest-bar-fill');
    this._el.questBar.appendChild(this._el.questFill);
    this._el.questTracker.append(this._el.questTitle, this._el.questObj, this._el.questBar);
    hud.appendChild(this._el.questTracker);

    // ── Resource direction indicator ──────────────────────────────────────────
    this._el.resIndicator = el('div', 'res-indicator hidden');
    this._el.resArrow     = el('div', 'res-arrow', '▲');
    this._el.resDist      = el('div', 'res-dist', '');
    this._el.resType      = el('div', 'res-type', '');
    this._el.resIndicator.append(this._el.resArrow, this._el.resDist, this._el.resType);
    hud.appendChild(this._el.resIndicator);

    // ── Space navigation HUD ─────────────────────────────────────────────────
    this._el.spaceNav = el('div', 'space-nav hidden');
    this._el.spaceNavDist     = el('div', 'space-nav-row', '');
    this._el.spaceNavNearest  = el('div', 'space-nav-row', '');
    this._el.spaceNavAU       = el('div', 'space-nav-row', '');
    this._el.spaceNav.append(
      el('div', 'space-nav-title', '🛸 NAVIGATION'),
      this._el.spaceNavDist,
      this._el.spaceNavNearest,
      this._el.spaceNavAU
    );
    hud.appendChild(this._el.spaceNav);
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
    // techTree.tree returns the TECH_UPGRADES config set via setConfig()
    const cfg = techTree._techConfig || {};
    for (const [cat, items] of Object.entries(cfg)) {
      const catEl = el('div', 'tech-cat');
      catEl.appendChild(el('h3', 'tech-cat-name', cat));
      for (const [id, tech] of Object.entries(items)) {
        const row     = el('div', 'tech-row');
        const tier    = techTree.upgrades[`${cat}.${id}`] || 0;
        const maxTier = tech.tiers.length;
        const fullyUnlocked = tier >= maxTier;
        const nameEl  = el('span', `tech-name ${fullyUnlocked ? 'unlocked' : ''}`,
          tier > 0 ? `${tech.name} (Tier ${tier}/${maxTier})` : tech.name);
        row.appendChild(nameEl);
        if (!fullyUnlocked) {
          const btn = el('button', 'mm-btn tech-btn', `UPGRADE Tier ${tier + 1}`);
          const canAfford = techTree.canAfford(cat, id, inventory);
          btn.disabled = !canAfford;
          // Show cost
          const tierDef = tech.tiers[tier];
          if (tierDef) {
            const costStr = Object.entries(tierDef.cost).map(([t,a])=>`${t}×${a}`).join(' ');
            const costEl = el('span', 'tech-cost', ` [${costStr}]`);
            row.appendChild(costEl);
          }
          btn.addEventListener('click', () => {
            if (techTree.upgrade(cat, id, inventory)) {
              this.showNotification(`✅ Upgraded: ${tech.name} Tier ${tier + 1}`, 'upgrade');
              this._renderTechTree(techTree, inventory);
            }
          });
          row.appendChild(btn);
        } else {
          row.appendChild(el('span', 'tech-done', '✔ MAX TIER'));
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
    // System info + warp row
    const infoRow = el('div', 'galaxy-info-row');
    this._el.galaxyWarpInfo = el('span', 'galaxy-sys-info', 'Click a star to select');
    this._el.galaxyWarpBtn  = el('button', 'mm-btn primary hidden', '🚀 WARP (1 Warp Cell)');
    this._el.galaxyWarpBtn.addEventListener('click', () => {
      if (this._galaxySelected && this._galaxyOnWarp) {
        this._galaxyOnWarp(this._galaxySelected);
      }
    });
    infoRow.append(this._el.galaxyWarpInfo, this._el.galaxyWarpBtn);
    const closeBtn = el('button', 'mm-btn', 'CLOSE (M)');
    closeBtn.addEventListener('click', () => this.hideGalaxyMap());
    panel.append(title, this._el.galaxyCanvas, infoRow, closeBtn);
    this._el.galaxyScreen.appendChild(panel);
    document.body.appendChild(this._el.galaxyScreen);
  }

  showGalaxyMap(galaxy, currentSystemId, onWarp) {
    this._el.galaxyScreen.classList.remove('hidden');
    this._galaxyOnWarp = onWarp || null;
    this._renderGalaxyCanvas(galaxy, currentSystemId);
    // Store for click handling
    this._galaxyData = { galaxy, currentSystemId };
    // Wire click on canvas for system selection
    if (this._el.galaxyCanvas && !this._el.galaxyCanvas._wired) {
      this._el.galaxyCanvas._wired = true;
      this._el.galaxyCanvas.addEventListener('click', (e) => {
        if (!this._galaxyData) return;
        const { galaxy: g, currentSystemId: curId } = this._galaxyData;
        const rect = this._el.galaxyCanvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (this._el.galaxyCanvas.width / rect.width);
        const my = (e.clientY - rect.top)  * (this._el.galaxyCanvas.height / rect.height);
        const systems = g.getSystems();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const s of systems) { minX=Math.min(minX,s.position.x); maxX=Math.max(maxX,s.position.x); minY=Math.min(minY,s.position.y); maxY=Math.max(maxY,s.position.y); }
        const w = this._el.galaxyCanvas.width, h = this._el.galaxyCanvas.height;
        const toScreen = (gx, gy) => ({
          sx: ((gx - minX) / (maxX - minX + 0.001)) * (w - 40) + 20,
          sy: ((gy - minY) / (maxY - minY + 0.001)) * (h - 40) + 20,
        });
        let best = null, bestDist = 18;
        for (const sys of systems) {
          const { sx, sy } = toScreen(sys.position.x, sys.position.y);
          const d = Math.hypot(sx - mx, sy - my);
          if (d < bestDist) { bestDist = d; best = sys; }
        }
        if (best) {
          this._galaxySelected = best;
          this._renderGalaxyCanvas(g, curId, best.id);
          // Show warp info
          if (this._el.galaxyWarpInfo) {
            this._el.galaxyWarpInfo.textContent = `${best.name}  ·  ${best.starType}-class  ·  ${best.economy}  ·  ${best.planets?.length || '?'} planets`;
            this._el.galaxyWarpBtn.classList.toggle('hidden', best.id === curId);
          }
        }
      });
    }
  }

  hideGalaxyMap() {
    this._el.galaxyScreen.classList.add('hidden');
    this._galaxySelected = null;
  }

  _renderGalaxyCanvas(galaxy, currentId, selectedId) {
    const canvas = this._el.galaxyCanvas;
    if (!canvas || !galaxy) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#030818';
    ctx.fillRect(0, 0, w, h);

    // Background star dust
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const rng = this._galaxyBgRng || (this._galaxyBgRng = (() => {
      let s = 0x1234abcd;
      return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/0x100000000; };
    })());
    for (let i = 0; i < 400; i++) ctx.fillRect(rng()*w, rng()*h, rng() > 0.97 ? 2 : 1, 1);

    const systems = galaxy.getSystems();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of systems) { minX=Math.min(minX,s.position.x); maxX=Math.max(maxX,s.position.x); minY=Math.min(minY,s.position.y); maxY=Math.max(maxY,s.position.y); }
    const toScreen = (gx, gy) => ({
      sx: ((gx - minX) / (maxX - minX + 0.001)) * (w - 40) + 20,
      sy: ((gy - minY) / (maxY - minY + 0.001)) * (h - 40) + 20,
    });

    // Warp range circle
    const cur = systems.find(s => s.id === currentId);
    if (cur) {
      const { sx, sy } = toScreen(cur.position.x, cur.position.y);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0,170,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw systems
    for (const sys of systems) {
      const { sx, sy } = toScreen(sys.position.x, sys.position.y);
      const isCurrent  = sys.id === currentId;
      const isSelected = sys.id === selectedId;
      const r = isCurrent ? 6 : 3;
      // Glow
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      grd.addColorStop(0, sys.starColor || '#fff');
      grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();
      // Core
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? '#0af' : (sys.starColor || '#fff');
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#0af'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, r + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#0af';
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillText(sys.name, sx + r + 4, sy - r);
      }
      if (isSelected && !isCurrent) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, r + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillText(sys.name, sx + r + 4, sy - r);
      }
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
  update(dt, player, planet, ship, terrain, gameState, creatures, mining) {
    if (!player) return;
    this._elapsed += dt;
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
    const pos = player.getPosition();
    if (planet && this._el.locPlanet) {
      this._el.locPlanet.textContent = planet.name || 'Unknown Planet';
    }
    if (planet && this._el.locBiome) {
      const biome = terrain ? terrain.getBiomeAt?.(pos.x, pos.z) : null;
      this._el.locBiome.textContent = biome ? biome.type : (planet.type || '');
    }
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

    // Mining ring – update arc with actual progress
    if (player.isMining) {
      if (this._el.miningRing) this._el.miningRing.classList.remove('hidden');
      if (this._el.miningArc && player._miningProgress != null) {
        this._setArcFill(this._el.miningArc, player._miningProgress);
      }
    } else {
      if (this._el.miningRing) this._el.miningRing.classList.add('hidden');
    }

    // Danger vignette – show when HP < 30 %
    if (this._el.dangerVignette) {
      const hpPct = stats.hp / stats.maxHp;
      this._el.dangerVignette.classList.toggle('active', hpPct < 0.30);
    }

    // Scan ring
    if (player.isScanning) {
      if (this._el.scanRing) this._el.scanRing.classList.remove('hidden');
    } else {
      if (this._el.scanRing) this._el.scanRing.classList.add('hidden');
    }

    // Minimap
    this._updateMinimap(pos, terrain, creatures, ship, planet, mining);

    // Notification drain
    this._notifT -= dt;
  }

  // ─── Damage flash (call on player hit) ────────────────────────────────────────
  flashDamage() {
    if (!this._el.damageFlash) return;
    const el2 = this._el.damageFlash;
    el2.classList.remove('flash');
    void el2.offsetWidth; // reflow to restart animation
    el2.classList.add('flash');
    setTimeout(() => el2.classList.remove('flash'), 400);
  }

  // ─── Level-up flash ───────────────────────────────────────────────────────────
  flashLevelUp() {
    const f = document.createElement('div');
    f.className = 'levelup-flash';
    f.style.position = 'fixed';
    f.style.inset = '0';
    f.style.pointerEvents = 'none';
    f.style.zIndex = '8';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────────
  _updateMinimap(playerPos, terrain, creatures, ship, planet, mining) {
    const ctx = this._el.mmCtx;
    if (!ctx) return;
    const w = 160, h = 160, range = 300;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,8,20,0.85)';
    ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();

    const waterLevel = planet?.waterLevel ?? 10;

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
          if (sy < waterLevel) {
            ctx.fillStyle = `rgba(20,60,180,0.7)`;
          } else {
            const bright = Math.min(1, sy / 50);
            ctx.fillStyle = `rgba(0,${Math.floor(bright*120+40)},${Math.floor(bright*80+30)},0.7)`;
          }
          ctx.fillRect(nx - 4, ny - 4, 8, 8);
        }
      }
    }

    // Creature dots
    if (creatures) {
      const nearby = creatures.getNearbyCreatures?.(playerPos, range) || [];
      for (const cr of nearby) {
        const cp = cr.getPosition();
        const cx = w/2 + (cp.x - playerPos.x) / range * w * 0.5;
        const cy = h/2 + (cp.z - playerPos.z) / range * h * 0.5;
        const hostile = cr.genome?.aggression === 'hostile';
        ctx.fillStyle = hostile ? '#ff4422' : '#44dd88';
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI*2); ctx.fill();
      }
    }

    // Ship dot
    if (ship) {
      const sp = ship.getPosition?.();
      if (sp) {
        const sx = w/2 + (sp.x - playerPos.x) / range * w * 0.5;
        const sy2 = h/2 + (sp.z - playerPos.z) / range * h * 0.5;
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(sx, sy2, 3.5, 0, Math.PI*2); ctx.fill();
      }
    }

    // Resource node dots (orange)
    if (mining) {
      const nodes = mining.getNodesNear?.(playerPos, range) || [];
      for (const n of nodes) {
        const rx = w/2 + (n.pos.x - playerPos.x) / range * w * 0.5;
        const ry = h/2 + (n.pos.z - playerPos.z) / range * h * 0.5;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.arc(rx, ry, 2, 0, Math.PI*2); ctx.fill();
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
    // Dedup: ignore if same text shown in last 2s
    const now = Date.now();
    if (!this._notifSeen) this._notifSeen = new Map();
    const last = this._notifSeen.get(text);
    if (last && now - last < 2000) return;
    this._notifSeen.set(text, now);
    // Limit max simultaneous notifs
    while (this._el.notifs.childElementCount >= 5) {
      this._el.notifs.firstChild?.remove();
    }
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
    // Red glow when below 25%
    if (this._el.bossFill) {
      this._el.bossFill.style.background = pct < 0.25 ? '#ff2200' : pct < 0.5 ? '#ff6600' : '#cc0000';
    }
  }
  hideBossBar() {
    if (this._el.bossBar) this._el.bossBar.classList.add('hidden');
  }

  // ─── Status effects row ───────────────────────────────────────────────────────
  setStatusEffects(icons) {
    const row = this._el.statusRow;
    if (!row) return;
    row.innerHTML = '';
    for (const s of (icons || [])) {
      const chip = el('div', 'status-chip');
      chip.title  = `${s.label} (${s.remaining}s)`;
      chip.textContent = `${s.icon} ${s.remaining}s`;
      row.appendChild(chip);
    }
  }

  // ─── Quest tracker ────────────────────────────────────────────────────────────
  setQuestSummary(summary) {
    if (!this._el.questTracker) return;
    if (!summary) {
      this._el.questTracker.classList.add('hidden');
      return;
    }
    this._el.questTracker.classList.remove('hidden');
    if (this._el.questTitle) this._el.questTitle.textContent = summary.title;
    if (this._el.questObj)   this._el.questObj.textContent   = summary.label;
    if (this._el.questFill) {
      const pct = summary.target > 0 ? Math.min(1, summary.progress / summary.target) : 0;
      this._el.questFill.style.width = (pct * 100) + '%';
    }
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

  // ─── Weather indicator ────────────────────────────────────────────────────────
  setWeather(name, windStrength) {
    if (!this._el.weatherLbl) return;
    const icons = {
      Clear: '☀', Rain: '🌧', Storm: '⛈', Snow: '🌨', Blizzard: '❄',
      Sandstorm: '🌪', 'Toxic Fog': '☁', Aurora: '✨',
    };
    const icon = icons[name] || '🌤';
    this._el.weatherLbl.textContent = `${icon} ${name}${windStrength > WIND_DISPLAY_THRESHOLD ? ` · Wind ${windStrength.toFixed(1)}` : ''}`;
  }

  // ─── Hazard vignette overlay ──────────────────────────────────────────────────
  updateHazardOverlay(hazardType, planet) {
    if (!this._el.vignette) return;
    const HAZARD_COLORS = {
      heat:      'rgba(200, 60, 0,',
      cold:      'rgba(0, 80, 200,',
      toxic:     'rgba(50, 180, 0,',
      radiation: 'rgba(180, 220, 0,',
      exotic:    'rgba(120, 0, 200,',
    };
    const col = HAZARD_COLORS[hazardType];
    const intensity = Math.min(1, ((planet?.toxicity || 0) + (planet?.radiation || 0)) * 1.5);
    if (col && intensity > 0.05) {
      const pulse = PULSE_BASE + Math.abs(Math.sin(this._elapsed * PULSE_SPEED)) * PULSE_AMPLITUDE;
      this._el.vignette.style.boxShadow = `inset 0 0 120px 40px ${col}${(intensity * 0.4 + pulse).toFixed(3)})`;
    } else {
      this._el.vignette.style.boxShadow = '';
    }
  }

  // ─── Scan results panel ───────────────────────────────────────────────────────
  showScanResults(lines) {
    const panel = this._el.scanPanel;
    if (!panel) return;
    panel.innerHTML = '';
    const title = el('div', 'scan-title', '📡 ANALYSIS VISOR');
    panel.appendChild(title);
    for (const line of lines) {
      const row = el('div', 'scan-line', line);
      panel.appendChild(row);
    }
    const close = el('button', 'scan-close', '✕');
    close.addEventListener('click', () => panel.classList.add('hidden'));
    panel.appendChild(close);
    panel.classList.remove('hidden');
    // Auto-dismiss after 8 s
    clearTimeout(this._scanDismissTimer);
    this._scanDismissTimer = setTimeout(() => panel.classList.add('hidden'), 8000);
  }

  // ─── Level / XP ───────────────────────────────────────────────────────────────
  setLevel(level, xp, xpToNext) {
    if (this._el.lvlNum)  this._el.lvlNum.textContent  = `Lv ${level}`;
    if (this._el.xpFill)  this._el.xpFill.style.width  = `${Math.min(100, (xp / xpToNext) * 100).toFixed(1)}%`;
    if (this._el.xpTxt)   this._el.xpTxt.textContent   = `${xp} / ${xpToNext} XP`;
  }

  // ─── Quickslot selection ──────────────────────────────────────────────────────
  selectQuickSlot(index) {
    if (!this._el.qslots) return;
    this._el.qslots.forEach((s, i) => s.slot.classList.toggle('active', i === index));
  }

  /** Populate quickslot icons from inventory slots 0–9 */
  updateQuickBar(inventory) {
    if (!this._el.qslots || !inventory) return;
    this._el.qslots.forEach((s, i) => {
      const slot = inventory.slots[i];
      if (slot) {
        // Use first 2 chars of type as icon + qty
        s.icon.textContent = slot.type.slice(0, 3).toUpperCase();
        s.qty.textContent  = slot.amount > 1 ? `×${slot.amount}` : '';
        s.slot.classList.add('has-item');
      } else {
        s.icon.textContent = (i + 1).toString();
        s.qty.textContent  = '';
        s.slot.classList.remove('has-item');
      }
    });
  }

  /** Show a directional indicator arrow toward the nearest resource node.
   *  angle: radians relative to camera yaw (0 = forward). null = hide. */
  setResourceIndicator(angle, distance, type) {
    if (!this._el.resIndicator) return;
    if (angle == null) {
      this._el.resIndicator.classList.add('hidden');
      return;
    }
    this._el.resIndicator.classList.remove('hidden');
    const deg = angle * 180 / Math.PI;
    if (this._el.resArrow)    this._el.resArrow.style.transform = `rotate(${deg}deg)`;
    if (this._el.resDist)     this._el.resDist.textContent      = `${Math.round(distance)}m`;
    if (this._el.resType)     this._el.resType.textContent      = type || '';
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
