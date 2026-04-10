/**
 * network.js — WebSocket multiplayer client for Aetheria: Endless Frontiers
 *
 * Handles player state sync, building events, chat, ping, auto-reconnect,
 * and mesh-network universe sync.
 */

const PROTOCOL_VERSION = '1.0';
const STATE_THROTTLE_MS = 50;   // ~20 Hz
const HEARTBEAT_MS      = 10000;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT     = 3;

export class NetworkManager {
  constructor() {
    this._ws             = null;
    this._serverUrl      = '';
    this._playerName     = '';
    this._playerId       = '';
    this._connected      = false;
    this._ping           = 0;
    this._playerCount    = 0;
    this._reconnectTries = 0;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._pingTimestamp  = 0;

    /** @type {Map<string, object>} */
    this._otherPlayers   = new Map();

    // Pending outgoing state (throttled)
    this._pendingState   = null;
    this._lastStateSent  = 0;
    this._stateTimer     = null;

    // Message queue when disconnected
    this._queue          = [];

    // ── Callbacks ──────────────────────────────────────────────────────────
    this._onPlayersUpdate  = null;
    this._onBuildingUpdate = null;
    this._onChatMessage    = null;
    this._onServerMessage  = null;
    this._onDisconnect     = null;
    this._onConnect        = null;
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /**
   * Connect to a WebSocket game server.
   * @param {string} serverUrl   e.g. 'ws://192.168.1.5:8080'
   * @param {string} playerName
   * @param {string} playerId    Unique local player ID
   */
  connect(serverUrl, playerName, playerId) {
    this._serverUrl  = serverUrl;
    this._playerName = playerName;
    this._playerId   = playerId;
    this._reconnectTries = 0;
    this._openSocket();
  }

  disconnect() {
    this._reconnectTries = MAX_RECONNECT; // prevent auto-reconnect
    this._clearTimers();
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }

  /** @returns {boolean} */
  isConnected() {
    return this._connected;
  }

  /**
   * @returns {{ url:string, playerCount:number, ping:number, isAndroid:boolean }}
   */
  getServerInfo() {
    return {
      url:         this._serverUrl,
      playerCount: this._playerCount,
      ping:        this._ping,
      isAndroid:   /android/i.test(navigator?.userAgent ?? ''),
    };
  }

  /** @returns {number} current round-trip ping in ms */
  getPing() {
    return this._ping;
  }

  // ── State sync ────────────────────────────────────────────────────────────

  /**
   * Queue a player state update — throttled to ~20 Hz automatically.
   * @param {{x,y,z}} pos
   * @param {{y:number}} rot
   * @param {number}  hp
   * @param {string}  state  e.g. 'idle' | 'walk' | 'fly' | 'fight'
   */
  sendPlayerState(pos, rot, hp, state) {
    this._pendingState = { pos, rot, hp, state };
    const now = Date.now();
    if (now - this._lastStateSent >= STATE_THROTTLE_MS) {
      this._flushState();
    }
  }

  /** @param {object} building — building record from BuildingSystem */
  sendBuildingPlaced(building) {
    this._send({ type: 'build', action: 'place', building });
  }

  /** @param {string} buildingId */
  sendBuildingRemoved(buildingId) {
    this._send({ type: 'build', action: 'remove', building: { id: buildingId } });
  }

  /** @param {string} text */
  sendChatMessage(text) {
    this._send({ type: 'chat', text });
  }

  /** @param {string} systemId */
  sendWarpEvent(systemId) {
    this._send({ type: 'warp', systemId });
  }

  // ── Callback setters ──────────────────────────────────────────────────────

  /** @param {function(Map<string,object>):void} cb */
  onPlayersUpdate(cb)  { this._onPlayersUpdate  = cb; }

  /** @param {function({action:string, building:object}):void} cb */
  onBuildingUpdate(cb) { this._onBuildingUpdate = cb; }

  /** @param {function({playerId:string,name:string,text:string,timestamp:number}):void} cb */
  onChatMessage(cb)    { this._onChatMessage    = cb; }

  /** @param {function({type:string,data:*}):void} cb */
  onServerMessage(cb)  { this._onServerMessage  = cb; }

  /** @param {function():void} cb */
  onDisconnect(cb)     { this._onDisconnect     = cb; }

  /** @param {function({playerId:string,playerCount:number}):void} cb */
  onConnect(cb)        { this._onConnect        = cb; }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** @returns {Map<string, object>} */
  getOtherPlayers() {
    return new Map(this._otherPlayers);
  }

  /** @returns {string} */
  getMyPlayerId() {
    return this._playerId;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /**
   * @param {string} cmd
   * @param {*}      args
   * @param {string} adminToken
   */
  sendAdminCommand(cmd, args, adminToken) {
    this._send({ type: 'admin', cmd, args, token: adminToken });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _openSocket() {
    if (this._ws) {
      try { this._ws.close(); } catch (_) {}
    }

    let ws;
    try {
      ws = new WebSocket(this._serverUrl);
    } catch (err) {
      console.warn('[Network] WebSocket creation failed:', err.message);
      this._scheduleReconnect();
      return;
    }
    this._ws = ws;

    ws.addEventListener('open', () => {
      this._connected = true;
      this._reconnectTries = 0;
      console.log('[Network] Connected to', this._serverUrl);

      // Send join handshake
      this._sendRaw({
        type:    'join',
        id:      this._playerId,
        name:    this._playerName,
        version: PROTOCOL_VERSION,
      });

      // Drain queue
      while (this._queue.length) {
        this._sendRaw(this._queue.shift());
      }

      // Start heartbeat
      this._clearTimers();
      this._heartbeatTimer = setInterval(() => this._sendPing(), HEARTBEAT_MS);
    });

    ws.addEventListener('message', evt => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }
      this._handleMessage(msg);
    });

    ws.addEventListener('close', () => {
      this._connected = false;
      this._clearTimers();
      console.warn('[Network] Connection closed');
      this._onDisconnect?.();
      this._scheduleReconnect();
    });

    ws.addEventListener('error', err => {
      console.warn('[Network] WebSocket error:', err.message ?? err);
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this._playerCount = msg.playerCount ?? 0;
        this._playerId    = msg.playerId ?? this._playerId;
        this._onConnect?.({ playerId: this._playerId, playerCount: this._playerCount });
        break;

      case 'players': {
        const map = new Map();
        for (const p of (msg.players ?? [])) {
          if (p.id !== this._playerId) {
            map.set(p.id, p);
          }
        }
        this._otherPlayers = map;
        this._playerCount  = map.size + 1;
        this._onPlayersUpdate?.(new Map(map));
        break;
      }

      case 'player_join':
        this._playerCount = (msg.playerCount ?? this._playerCount);
        break;

      case 'player_leave':
        this._otherPlayers.delete(msg.id);
        this._onPlayersUpdate?.(new Map(this._otherPlayers));
        break;

      case 'build':
        this._onBuildingUpdate?.({ action: msg.action, building: msg.building });
        break;

      case 'chat':
        this._onChatMessage?.({
          playerId:  msg.id   ?? 'server',
          name:      msg.name ?? 'Server',
          text:      msg.text,
          timestamp: msg.timestamp ?? Date.now(),
        });
        break;

      case 'announce':
        this._onServerMessage?.({ type: 'announce', data: { text: msg.text, severity: msg.severity } });
        break;

      case 'kick':
        if (msg.targetId === this._playerId || !msg.targetId) {
          this._onServerMessage?.({ type: 'kicked', data: { reason: msg.reason } });
          this.disconnect();
        }
        break;

      case 'pong': {
        const rtt = Date.now() - this._pingTimestamp;
        this._ping = Math.max(0, rtt);
        break;
      }

      case 'universe_sync':
        this._onServerMessage?.({ type: 'universe_sync', data: msg });
        break;

      case 'warp':
        this._onServerMessage?.({ type: 'warp', data: { systemId: msg.systemId, fromId: msg.id } });
        break;

      default:
        // Forward unknown messages to the generic handler
        this._onServerMessage?.({ type: msg.type, data: msg });
    }
  }

  _flushState() {
    if (!this._pendingState) return;
    this._send({ type: 'state', ...this._pendingState });
    this._lastStateSent = Date.now();
    this._pendingState  = null;
  }

  _sendPing() {
    this._pingTimestamp = Date.now();
    this._sendRaw({ type: 'ping' });
  }

  _send(msg) {
    if (this._connected && this._ws?.readyState === WebSocket.OPEN) {
      this._sendRaw(msg);
    } else {
      // Queue for later (limit size to avoid memory bloat)
      if (this._queue.length < 200) {
        this._queue.push(msg);
      }
    }
  }

  _sendRaw(msg) {
    try {
      this._ws.send(JSON.stringify(msg));
    } catch (err) {
      console.warn('[Network] Send failed:', err.message);
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTries >= MAX_RECONNECT) {
      console.warn('[Network] Max reconnect attempts reached');
      return;
    }
    this._reconnectTries++;
    console.log(`[Network] Reconnect attempt ${this._reconnectTries}/${MAX_RECONNECT} in ${RECONNECT_DELAY_MS}ms`);
    this._reconnectTimer = setTimeout(() => this._openSocket(), RECONNECT_DELAY_MS);
  }

  _clearTimers() {
    clearInterval(this._heartbeatTimer);
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._stateTimer);
    this._heartbeatTimer = null;
    this._reconnectTimer = null;
    this._stateTimer     = null;
  }
}
