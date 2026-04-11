/**
 * help.js — In-game help and guide system for Aetheria: Endless Frontiers
 */

const TOPICS = {
  getting_started: {
    title: '🚀 Getting Started',
    content: `
      <h3>First Steps</h3>
      <ol>
        <li><strong>Choose your class</strong> — Runekeeper (balanced), Technomancer (tech/drones), or Voidhunter (stealth/burst). You can always start a new game to try another.</li>
        <li><strong>Mine resources</strong> — Hold <kbd>LMB</kbd> on glowing deposits to extract materials. Carbon, Ferrite Dust, and Oxygen are common first finds.</li>
        <li><strong>Open your Inventory</strong> — Press <kbd>Tab</kbd> to see what you've collected. Drag items to rearrange; click to inspect.</li>
        <li><strong>Craft essentials</strong> — Press <kbd>N</kbd> for the crafting panel. Start with a Medkit (Sodium + Oxygen) and Shield Battery (Copper + Cobalt).</li>
        <li><strong>Scan everything</strong> — Press <kbd>F</kbd> to activate the Analysis Visor. Scanning fauna, flora, and minerals earns Nanites for upgrades.</li>
        <li><strong>Build a base</strong> — Press <kbd>B</kbd> to open the build menu. Place a Base Computer first, then expand with Extractors and Power Generators.</li>
        <li><strong>Save often</strong> — Press <kbd>Esc</kbd> to pause, then click 💾 SAVE GAME. Your progress is stored locally in your browser.</li>
      </ol>
      <h3>Survival Priority</h3>
      <p>Watch your <strong>Life Support</strong> and <strong>Hazard</strong> bars at the top of your HUD. Recharge Life Support with Oxygen or Di-hydrogen. Hazard varies by planet biome — craft the appropriate protection.</p>
      <h3>First Quest</h3>
      <p>A quest objective appears in the top-right tracker. Follow it to complete your first mission and earn bonus XP and resources to get started.</p>
    `
  },
  controls: {
    title: '🎮 Controls Reference',
    content: `
      <h3>Movement</h3>
      <table><tr><td>WASD / Arrow Keys</td><td>Move</td></tr>
      <tr><td>Space</td><td>Jump / Jetpack burst</td></tr>
      <tr><td>Shift</td><td>Sprint</td></tr>
      <tr><td>C</td><td>Crouch</td></tr>
      <tr><td>Mouse</td><td>Look</td></tr>
      <tr><td>Click to lock</td><td>Enable mouse look</td></tr></table>
      <h3>Actions</h3>
      <table><tr><td>E</td><td>Interact / Mine</td></tr>
      <tr><td>F</td><td>Scan terrain</td></tr>
      <tr><td>R</td><td>Reload / Recharge</td></tr>
      <tr><td>G</td><td>Place/cancel building</td></tr>
      <tr><td>B</td><td>Open build menu</td></tr>
      <tr><td>Tab</td><td>Inventory</td></tr>
      <tr><td>M</td><td>Galaxy map</td></tr>
      <tr><td>T</td><td>Chat</td></tr>
      <tr><td>H</td><td>This help panel</td></tr>
      <tr><td>Esc</td><td>Pause / Close menus</td></tr></table>
      <h3>Ship / Space Flight</h3>
      <table><tr><td>Enter ship</td><td>Walk up and press E</td></tr>
      <tr><td>W/S</td><td>Thrust / Brake</td></tr>
      <tr><td>Mouse</td><td>Pitch & Yaw</td></tr>
      <tr><td>Shift</td><td>Boost (pulse drive)</td></tr>
      <tr><td>X</td><td>Warp to another system</td></tr></table>
      <h3>Mobile / Touch</h3>
      <p>Left joystick: Move &nbsp;|&nbsp; Right joystick: Look<br>
      Jump button, Action button, and Build button appear on-screen.</p>
    `
  },
  universe: {
    title: '🌌 Universe Structure',
    content: `
      <p>Aetheria features a procedurally generated universe of near-infinite scale, seeded by a single 64-bit hash.</p>
      <h3>Scale</h3>
      <ul>
        <li><strong>Galaxies</strong> — 255 per universe, each with unique star density and lore</li>
        <li><strong>Star Systems</strong> — millions per galaxy, generated on demand</li>
        <li><strong>Planets</strong> — 1–6 per system, each with biome, hazards, and resources</li>
        <li><strong>Points of Interest</strong> — ruins, outposts, crashed ships, monoliths</li>
      </ul>
      <h3>Navigation</h3>
      <p>Open the <em>Galaxy Map</em> (M) to see nearby systems. Warping costs <strong>warp cells</strong> — craft them from Di-hydrogen and Metal Plating.</p>
      <h3>Discovery</h3>
      <p>Scanning a planet for the first time grants <strong>Nanites</strong> and permanent discovery credit. First discoveries get named after you.</p>
    `
  },
  crafting: {
    title: '⚗️ Crafting & Technology',
    content: `
      <h3>Inventory Crafting</h3>
      <p>Open your inventory (Tab) and click any slot to craft or upgrade items directly.</p>
      <h3>Technology Modules</h3>
      <ul>
        <li><strong>Mining Laser</strong> — core tool, upgrade for speed and heat efficiency</li>
        <li><strong>Jetpack</strong> — upgrade fuel capacity and thrust</li>
        <li><strong>Life Support</strong> — upgrade battery duration</li>
        <li><strong>Shield</strong> — upgrade absorption and recharge rate</li>
        <li><strong>Pulse Engine</strong> — upgrade for ship speed and warp range</li>
      </ul>
      <h3>Blueprints</h3>
      <p>Buy blueprints from <em>Technology Merchants</em> at space stations, or find them in ruins.</p>
      <h3>Key Resources</h3>
      <table>
        <tr><td>Carbon</td><td>Flora, basic fuel</td></tr>
        <tr><td>Iron / Ferrite</td><td>Rocks, construction</td></tr>
        <tr><td>Sodium</td><td>Yellow plants, hazard protection</td></tr>
        <tr><td>Gold</td><td>Rare boulders, high value trade</td></tr>
        <tr><td>Di-hydrogen</td><td>Blue crystals, warp cells</td></tr>
        <tr><td>Nanites</td><td>Currency for blueprints</td></tr>
      </table>
    `
  },
  survival: {
    title: '❤️ Survival Guide',
    content: `
      <h3>Life Support</h3>
      <p>Your suit has a <strong>life support battery</strong>. In toxic, extreme, or radioactive biomes it drains fast. Recharge with <em>Carbon</em> or <em>Di-hydrogen</em>.</p>
      <h3>Hazards</h3>
      <ul>
        <li><strong>Extreme Heat</strong> — drain Sodium Nitrate or take shelter in caves</li>
        <li><strong>Blizzard</strong> — Sodium provides temporary warmth</li>
        <li><strong>Radiation</strong> — Phosphorus counters radiation drain</li>
        <li><strong>Toxic Rain</strong> — Pugneum or Fungal Clusters provide resistance</li>
        <li><strong>Storms</strong> — Seek cave shelter; storms pass in 2–4 minutes</li>
      </ul>
      <h3>Sentinel Evasion</h3>
      <ul>
        <li>Mining within limits keeps wanted level at 0</li>
        <li>At ★ — Two Sentinels investigate. Stop mining and move away.</li>
        <li>At ★★ — Walkers deployed. Run to your ship or hide in cave.</li>
        <li>At ★★★★ — Hardframe battle mechs. Outrun in ship immediately.</li>
        <li>Wanted level resets after hiding for ~30 seconds with no line-of-sight.</li>
        <li>Turrets at your base can defend against Sentinel incursions.</li>
      </ul>
      <h3>Combat Tips</h3>
      <p>Aim for Sentinel eye cores. Boltcasters are effective vs standard Sentinels; Plasma Launchers for armoured variants. Keep shield above 30%.</p>
    `
  },
  buildings: {
    title: '🏗️ Buildings & Empire',
    content: `
      <h3>Getting Started</h3>
      <p>Press <strong>B</strong> to open the build menu. Select a structure, aim at the ground, and press <strong>G</strong> to place.</p>
      <h3>Power Grid</h3>
      <p>Buildings with power cost (⚡) require a <strong>Power Generator</strong> within your settlement. One generator supplies 100 power units. Chain multiple generators for large bases.</p>
      <h3>Factory Chains</h3>
      <ol>
        <li>Place <strong>Extractor</strong> → harvests 2–5 resources every 10 seconds</li>
        <li>Place <strong>Conveyor Links</strong> → connects buildings</li>
        <li>Place <strong>Storage Container</strong> → buffers surplus</li>
        <li>Place <strong>Research Station</strong> → converts resources to Nanites</li>
      </ol>
      <h3>Town Hub</h3>
      <p>The <strong>Town Hub</strong> (🏛) is the anchor of any settlement. It projects a 300-unit influence radius — advanced buildings can only be placed within this zone. Upgrade it to expand radius.</p>
      <h3>Defense</h3>
      <p>Ring your base with <strong>Walls</strong> and <strong>Turrets</strong>. Turrets auto-target Sentinels. During raids, active turrets share threat with the player.</p>
      <h3>Multiplayer</h3>
      <p>Buildings placed by any player are visible to the whole server. Build together to create shared empires!</p>
    `
  },
  multiplayer: {
    title: '🌐 Multiplayer Guide',
    content: `
      <h3>Auto-Detection</h3>
      <p>The server URL is <strong>auto-detected</strong> from your browser. When you open the game directly from the server's IP address (e.g. <code>http://192.168.1.5:8080</code>), multiplayer connects automatically — no manual URL entry needed.</p>
      <h3>Joining a Server</h3>
      <p>On the main menu, use the <strong>CONNECT</strong> panel. Leave the URL blank for auto-detection, or enter a custom address (e.g. <code>ws://192.168.1.5:8080</code>) and click 🌐 CONNECT. Status shows green when connected.</p>
      <h3>Hosting on PC / Linux</h3>
      <pre>npm install
node server.js</pre>
      <p>Share your LAN IP with friends. Default port: <strong>8080</strong>. Friends open <code>http://your-ip:8080</code> in their browser and multiplayer connects automatically.</p>
      <h3>Hosting on Android (Termux)</h3>
      <pre>pkg install nodejs
git clone &lt;repo&gt;
cd Aetheria-Endless-Frontiers
npm install
node server.js</pre>
      <p>Your phone becomes the game server! Share your phone's IP address with friends on the same Wi-Fi network. They open <code>http://phone-ip:8080</code> and connect automatically.</p>
      <h3>Mesh Networking</h3>
      <p>Multiple servers auto-sync via peer mesh. Set <code>MESH_PEERS=ws://other:8080</code> env var. Players on any node see each other.</p>
      <h3>Admin Panel</h3>
      <p>Open <code>http://serverIP:8080/admin</code> to manage players, ban griefers, and broadcast announcements.</p>
    `
  },
  lore: {
    title: '📖 Lore — The Atlas Codex',
    content: `
      <h3>The Atlas</h3>
      <p>A vast, ancient intelligence that permeates the universe. It created — or perhaps <em>is</em> — the simulation. Its red geometric constructs appear across all galaxies as <em>Atlas Interfaces</em>, offering knowledge and a path toward understanding.</p>
      <h3>The Void</h3>
      <p>Beyond the 256th galaxy lies the Void — pure white, featureless, infinite. Travellers who reach it report fragmented memories and recursion errors in their HUD. The Atlas remains silent about its nature.</p>
      <h3>Korvax</h3>
      <p>A collective consciousness species, formerly enslaved by the Gek. Korvax are scientists and philosophers who revere the Atlas as a divine construct. Their Convergence — a shared neural network — allows collective memory and instant communication. They are generally friendly to Travellers.</p>
      <h3>Gek</h3>
      <p>Small, amphibious merchant species. The First Spawn Gek once enslaved the Korvax in the name of the Gek Dominion. After their defeat by the Vy'keen and an Atlas judgment event, modern Gek turned to commerce. Trading and diplomacy is their primary mode of interaction.</p>
      <h3>Vy'keen</h3>
      <p>Warrior race who worship the Hirk, a legendary Vy'keen who united the clans against Gek imperialism. Militaristic but honourable — earn their respect through combat and sacrifice. They despise Sentinels and hunt them for sport.</p>
      <h3>Sentinels</h3>
      <p>Autonomous robotic custodians of the Atlas. They enforce "balance" across planets — preventing over-mining and protecting ecosystems. Their true origin is unknown, though Korvax texts hint at a connection to an earlier civilisation that was erased.</p>
      <h3>Travellers</h3>
      <p>That's you. A being of unknown origin, waking repeatedly with no memories. Korvax philosophers believe Travellers are echoes — fragments of consciousness from outside the simulation, drawn in by the Atlas for an unknown purpose.</p>
    `
  },
  economy: {
    title: '💰 Economy Guide',
    content: `
      <h3>Currencies</h3>
      <ul>
        <li><strong>Units (₩)</strong> — Primary currency. Earned by selling resources, trading ships, completing missions.</li>
        <li><strong>Nanites (⬡)</strong> — Research currency. Buy technology blueprints. Earned from damaged machinery, uploading discoveries, Research Stations.</li>
        <li><strong>Quicksilver (✦)</strong> — Rare event currency. Earned from community events and Nexus missions.</li>
      </ul>
      <h3>Trading</h3>
      <p>Every space station has a <em>Galactic Trade Terminal</em>. Prices fluctuate by system economy type:</p>
      <ul>
        <li><strong>Manufacturing</strong> — buys raw materials at premium</li>
        <li><strong>Mining</strong> — sells refined metals cheaply</li>
        <li><strong>Scientific</strong> — buys exotic elements</li>
        <li><strong>Trading</strong> — balanced prices, most trade routes</li>
        <li><strong>Military</strong> — buys weapons components</li>
      </ul>
      <h3>High-Value Resources</h3>
      <table>
        <tr><td>Gold</td><td>₩250/unit</td></tr>
        <tr><td>Platinum</td><td>₩530/unit</td></tr>
        <tr><td>Chromatic Metal</td><td>₩420/unit (refine from copper)</td></tr>
        <tr><td>Activated Indium</td><td>₩900/unit (blue star systems)</td></tr>
        <tr><td>Living Pearls</td><td>₩5,200 each (underwater)</td></tr>
      </table>
      <h3>Freighters & Trade Routes</h3>
      <p>Own a Freighter to carry bulk cargo across systems. Set up automated routes: extract → store → sell. With 5+ extractors and a Research Station, you can earn 50,000+ units per real-time hour.</p>
    `
  },
  tips: {
    title: '💡 Tips & Tricks',
    content: `
      <h3>Combat</h3>
      <ul>
        <li>Use your class Ultimate (<kbd>F</kbd>) at the start of tough fights for a decisive advantage.</li>
        <li>Strafe while firing — standing still makes you an easy target for Sentinels and elite creatures.</li>
        <li>Void Hunters should open with Shadow Step (<kbd>Q</kbd>) to gain positional advantage before engaging.</li>
        <li>Shield Battery cooldown is short — pop one proactively before a boss ability, not after.</li>
      </ul>
      <h3>Exploration</h3>
      <ul>
        <li>Jetpack has unlimited range — chain short bursts to traverse terrain without landing.</li>
        <li>Scan the sky at night: rare fauna only spawn after dark and are worth 3× Nanite bounties.</li>
        <li>Crashed ships are found near craters — repair them for a free upgrade or sell the tech modules.</li>
        <li>Underwater biomes contain exclusive resources (Living Pearls, Kelp Sac) worth thousands of units.</li>
      </ul>
      <h3>Base Building</h3>
      <ul>
        <li>Place Extractors directly on highlighted deposit nodes for 2× yield.</li>
        <li>Connect a Research Station to your base — it passively generates Nanites over time.</li>
        <li>The Town Hub raises your base influence radius to 300u, letting you build further from the core.</li>
        <li>Biofuel Reactors are unlimited-fuel generators — pair one with every 3 Extractors.</li>
      </ul>
      <h3>Economy</h3>
      <ul>
        <li>Refine raw ores before selling — Chromatic Metal sells for 3× the raw Copper value.</li>
        <li>Living Pearls (₩5,200 each) are the best early-game income if you can handle underwater hazards.</li>
        <li>Stack technology upgrades in adjacent slots for hidden synergy bonuses.</li>
        <li>The Trading Post at your base auto-sells excess stock at market rate every few minutes.</li>
      </ul>
      <h3>Multiplayer</h3>
      <ul>
        <li>Build in a friend's base range to contribute to the shared empire — all buildings are server-persistent.</li>
        <li>Sharing a waypoint marker (Galaxy Map → right-click) lets teammates warp to your exact location.</li>
        <li>If you die in multiplayer, your loot bag spawns at the death site — teammates can return it to you.</li>
      </ul>
    `
  },
};

export class HelpSystem {
  static TIPS = [
    'Mine Carbon from plants to refuel your Life Support anywhere.',
    'Scanning flora and fauna uploads discoveries for Nanite rewards.',
    'Caves are safe from storms and extreme weather — seek shelter when hazard warnings appear.',
    'Hold the mining laser on a resource deposit for a fast extraction burst.',
    'Crashed ships can be repaired and are often better than your starter vessel.',
    'Sentinels lose interest if you hide in a cave with no line-of-sight for 30 seconds.',
    'Build a Power Generator before placing Extractors — they need power to function.',
    'The Town Hub extends your base influence radius to 300 units.',
    'Warp Cells are crafted from Di-hydrogen Jelly + Metal Plating.',
    'Each planet has a primary resource that Extractors will harvest automatically.',
    'Research Stations slowly generate Nanites — build several for passive income.',
    'Stack technology upgrades in adjacent inventory slots for bonus synergy.',
    'Space Stations have free teleporter links to all previously visited stations.',
    'Blue star systems contain Activated Indium — the most valuable harvestable resource.',
    'Your ship\'s Pulse Drive can outrun any Sentinel fighter — just fly in a straight line.',
    'Toxic and Radioactive planets have rare exclusive resources worth trading.',
    'Farm Hydroponic units passively grow Carbon and Mordite inside your base.',
    'The Atlas Path leads to galaxy centre — follow red Atlas Stations for the story.',
    'Multiplayer: run "node server.js" on any PC or Android phone to host for friends.',
    'Walls and Turrets protect your base during Sentinel raids. Turrets share aggro.',
    'Sell duplicate tech modules at space stations for a quick Units boost.',
    'Deep caves often contain massive ore deposits and ancient ruins.',
    'Your jetpack can sustain short glides — strafe-jump + glide to cover distance fast.',
  ];

  /**
   * @param {HTMLElement} hudElement — the #hud container
   */
  constructor(hudElement) {
    this._hud         = hudElement;
    this._overlay     = null;
    this._activeTopic = null;
    this._contextShown = new Set();
    this._buildOverlay();
  }

  /** Show help for a named topic. */
  show(topic) {
    const def = TOPICS[topic];
    if (!def) return;
    this._activeTopic = topic;
    this._titleEl.textContent  = def.title;
    this._bodyEl.innerHTML     = def.content;
    this._overlay.style.display = 'flex';
    this._navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.topic === topic);
    });
  }

  /** Hide the help overlay. */
  hide() {
    this._overlay.style.display = 'none';
    this._activeTopic = null;
  }

  /** Toggle the overlay for a topic. */
  toggle(topic) {
    if (this._overlay.style.display !== 'none' && this._activeTopic === topic) {
      this.hide();
    } else {
      this.show(topic);
    }
  }

  /**
   * Show a contextual one-time tip based on game context.
   * @param {'first_mine'|'first_sentinel'|'first_warp'|'build_mode'|'space_flight'} context
   */
  showContextual(context) {
    if (this._contextShown.has(context)) return;
    this._contextShown.add(context);

    const messages = {
      first_mine:     '💡 Tip: Hold E on any glowing rock or plant to mine resources.',
      first_sentinel: '⚠️ Sentinel detected! Stop mining and move away — wait 30s in a cave to lose wanted level.',
      first_warp:     '🚀 Warp Drive ready. Open Galaxy Map (M) to pick a destination system.',
      build_mode:     '🏗 Build Mode: Place a Power Generator first, then Extractors to automate resource collection.',
      space_flight:   '🛸 In space: W to accelerate, Shift to boost. Press X to initiate warp to another system.',
    };

    const text = messages[context];
    if (!text) return;

    const toast = document.createElement('div');
    toast.className = 'help-toast';
    toast.textContent = text;
    toast.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      background:rgba(0,20,40,0.92); color:#88ccff; border:1px solid #336699;
      padding:10px 20px; border-radius:8px; font-family:'Orbitron',sans-serif;
      font-size:13px; z-index:9999; max-width:480px; text-align:center;
      animation: helpToastIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      setTimeout(() => toast.remove(), 450);
    }, 5000);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.style.cssText = `
      display:none; position:fixed; inset:0; z-index:8000;
      background:rgba(0,0,0,0.78); align-items:center; justify-content:center;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background:linear-gradient(160deg,#050f1a,#0a1e2e);
      border:1px solid #1a4466; border-radius:12px;
      width:min(820px,96vw); max-height:85vh; display:flex; flex-direction:column;
      overflow:hidden; box-shadow:0 0 40px rgba(0,120,255,0.25);
      font-family:'Segoe UI',sans-serif; color:#cce4f8;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 24px; border-bottom:1px solid #1a3350;
      background:rgba(0,20,40,0.6);
    `;
    const titleEl = document.createElement('h2');
    titleEl.style.cssText = `margin:0; font-size:18px; color:#88ccff; font-family:'Orbitron',sans-serif;`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `background:none; border:none; color:#88aacc; font-size:20px; cursor:pointer;`;
    closeBtn.onclick = () => this.hide();
    header.append(titleEl, closeBtn);

    // Nav tabs
    const nav = document.createElement('div');
    nav.style.cssText = `
      display:flex; flex-wrap:wrap; gap:4px; padding:10px 16px;
      border-bottom:1px solid #1a3350; background:rgba(0,10,25,0.5);
    `;
    this._navBtns = [];
    for (const [key, def] of Object.entries(TOPICS)) {
      const btn = document.createElement('button');
      btn.textContent = def.title.split(' ').slice(0,2).join(' ');
      btn.dataset.topic = key;
      btn.style.cssText = `
        background:rgba(0,40,80,0.6); border:1px solid #1a4466; color:#88aacc;
        padding:5px 12px; border-radius:5px; font-size:12px; cursor:pointer;
        font-family:'Orbitron',sans-serif;
      `;
      btn.onclick = () => this.show(key);
      nav.appendChild(btn);
      this._navBtns.push(btn);
    }

    // Body
    const body = document.createElement('div');
    body.style.cssText = `
      flex:1; overflow-y:auto; padding:20px 28px; line-height:1.7; font-size:14px;
    `;
    body.innerHTML = '<p style="color:#557799">Select a topic above.</p>';

    // Inject basic table/pre styles
    const style = document.createElement('style');
    style.textContent = `
      #help-overlay table{border-collapse:collapse;width:100%;margin:8px 0}
      #help-overlay td{padding:4px 12px;border:1px solid #1a3a55;color:#a8cce8}
      #help-overlay td:first-child{color:#66bbee;width:45%}
      #help-overlay h3{color:#55aadd;margin:14px 0 6px;font-size:14px}
      #help-overlay pre{background:rgba(0,20,40,0.7);border:1px solid #1a3a55;
        border-radius:6px;padding:10px 14px;overflow-x:auto;color:#88ddff;font-size:12px}
      #help-overlay ul,#help-overlay ol{padding-left:22px}
      #help-overlay li{margin:4px 0;color:#a8cce8}
      #help-overlay strong{color:#88ddff}
      #help-overlay code{background:rgba(0,40,80,0.5);border-radius:3px;padding:1px 5px;color:#66eecc}
      @keyframes helpToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    `;

    panel.append(style, header, nav, body);
    overlay.appendChild(panel);

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) this.hide(); });

    // Keyboard shortcut
    document.addEventListener('keydown', e => {
      if (e.key === 'h' || e.key === 'H') this.toggle('controls');
      if (e.key === 'Escape' && this._overlay?.style.display !== 'none') this.hide();
    });

    (this._hud?.ownerDocument?.body ?? document.body).appendChild(overlay);
    this._overlay = overlay;
    this._titleEl = titleEl;
    this._bodyEl  = body;
  }
}
