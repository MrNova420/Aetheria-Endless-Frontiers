/**
 * src/audio.js  –  Web Audio API procedural sound engine
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._ambientNodes = [];
    this._musicNodes = [];
    this._jetpackOsc = null;
    this._shipOsc = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
    this.initialized = true;
  }

  _ensureInit() { if (!this.initialized) this.init(); }

  _makeReverb(duration = 1.5) {
    const len = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2);
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  _makeNoise(duration = 0.1) {
    const len = Math.ceil(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  playAmbient(biomeType) {
    this._ensureInit();
    this.stopAmbient();
    const t = this.ctx.currentTime;
    const nodes = [];

    // Base drone
    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    const drones = { LUSH:55, BARREN:45, TOXIC:60, FROZEN:50, BURNING:65, EXOTIC:70, DEAD:40, OCEAN:52 };
    drone.frequency.value = drones[biomeType] || 50;
    const dg = this.ctx.createGain(); dg.gain.value = 0.06;
    drone.connect(dg); dg.connect(this.master);
    drone.start(t); nodes.push(drone, dg);

    // Wind noise layer
    const noise = this._makeNoise(999);
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = biomeType === 'TOXIC' ? 800 : biomeType === 'FROZEN' ? 400 : 600;
    filter.Q.value = 0.5;
    const ng = this.ctx.createGain(); ng.gain.value = 0.05;
    noise.connect(filter); filter.connect(ng); ng.connect(this.master);
    noise.start(t); nodes.push(noise, filter, ng);

    // Exotic bioluminescent pulse
    if (biomeType === 'EXOTIC') {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = 220;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.5;
      const lfog = this.ctx.createGain(); lfog.gain.value = 0.04;
      lfo.connect(lfog); lfog.connect(osc.frequency);
      const og = this.ctx.createGain(); og.gain.value = 0.04;
      osc.connect(og); og.connect(this.master);
      osc.start(t); lfo.start(t); nodes.push(osc, og, lfo, lfog);
    }

    this._ambientNodes = nodes;
  }

  stopAmbient() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this._ambientNodes) {
      try { if (n.stop) n.stop(t + 0.1); } catch(e) {}
    }
    this._ambientNodes = [];
  }

  playOneShot(type) {
    this._ensureInit();
    const t = this.ctx.currentTime;
    switch (type) {
      case 'mine': {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, t);
        o.frequency.linearRampToValueAtTime(400, t + 0.15);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.15, t);
        g.gain.linearRampToValueAtTime(0.0, t + 0.2);
        o.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t + 0.2);
        break;
      }
      case 'footstep': {
        const n = this._makeNoise(0.06);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 300;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.linearRampToValueAtTime(0.0, t + 0.06);
        const rev = this._makeReverb(0.3);
        n.connect(f); f.connect(g); g.connect(rev); rev.connect(this.sfxGain);
        n.start(t);
        break;
      }
      case 'jetpack': {
        if (!this._jetpackOsc) {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = 800;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 20;
          const lfog = this.ctx.createGain(); lfog.gain.value = 100;
          lfo.connect(lfog); lfog.connect(o.frequency);
          const g = this.ctx.createGain(); g.gain.value = 0.08;
          o.connect(g); g.connect(this.sfxGain);
          o.start(t); lfo.start(t);
          this._jetpackOsc = { o, lfo, g };
        }
        break;
      }
      case 'jetpack_stop': {
        if (this._jetpackOsc) {
          try { this._jetpackOsc.o.stop(t+0.1); this._jetpackOsc.lfo.stop(t+0.1); } catch(e){}
          this._jetpackOsc = null;
        }
        break;
      }
      case 'ship_engine': {
        if (!this._shipOsc) {
          const o1 = this.ctx.createOscillator(); o1.type='sawtooth'; o1.frequency.value=80;
          const o2 = this.ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=160;
          const g = this.ctx.createGain(); g.gain.value=0.1;
          o1.connect(g); o2.connect(g); g.connect(this.sfxGain);
          o1.start(t); o2.start(t);
          this._shipOsc = { o1, o2, g };
        }
        break;
      }
      case 'ship_engine_stop': {
        if (this._shipOsc) {
          try { this._shipOsc.o1.stop(t+0.2); this._shipOsc.o2.stop(t+0.2); } catch(e){}
          this._shipOsc = null;
        }
        break;
      }
      case 'warp': {
        const o = this.ctx.createOscillator(); o.type='sine';
        o.frequency.setValueAtTime(100, t);
        o.frequency.exponentialRampToValueAtTime(4000, t+1.5);
        o.frequency.exponentialRampToValueAtTime(50, t+2.5);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, t);
        g.gain.linearRampToValueAtTime(0.4, t+0.5);
        g.gain.linearRampToValueAtTime(0.0, t+2.5);
        const rev = this._makeReverb(3);
        o.connect(g); g.connect(rev); rev.connect(this.sfxGain);
        o.start(t); o.stop(t+2.5);
        break;
      }
      case 'discovery': {
        const notes = [261.63, 293.66, 329.63, 392.0, 440.0];
        notes.forEach((freq, i) => {
          const o = this.ctx.createOscillator(); o.type='sine';
          o.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0, t+i*0.12);
          g.gain.linearRampToValueAtTime(0.15, t+i*0.12+0.05);
          g.gain.linearRampToValueAtTime(0.0, t+i*0.12+0.3);
          o.connect(g); g.connect(this.sfxGain);
          o.start(t+i*0.12); o.stop(t+i*0.12+0.35);
        });
        break;
      }
      case 'hit': {
        const n = this._makeNoise(0.1);
        const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0.0, t+0.1);
        n.connect(f); f.connect(g); g.connect(this.sfxGain); n.start(t);
        break;
      }
      case 'death': {
        const o = this.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(300,t); o.frequency.linearRampToValueAtTime(50,t+1.5);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3,t); g.gain.linearRampToValueAtTime(0.0,t+1.5);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t+1.5);
        break;
      }
      case 'ui_click': {
        const o = this.ctx.createOscillator(); o.type='sine'; o.frequency.value=1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06,t); g.gain.linearRampToValueAtTime(0.0,t+0.05);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t+0.06);
        break;
      }
      case 'ability': {
        const o = this.ctx.createOscillator(); o.type='square'; o.frequency.value=600;
        o.frequency.linearRampToValueAtTime(1200, t+0.1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12,t); g.gain.linearRampToValueAtTime(0.0,t+0.15);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t+0.15);
        break;
      }
      case 'attack_shoot': {
        // Sci-fi blaster pew
        const o = this.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(800, t);
        o.frequency.exponentialRampToValueAtTime(120, t+0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t); g.gain.linearRampToValueAtTime(0.0, t+0.2);
        const filter = this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=3000;
        o.connect(filter); filter.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t+0.22);
        break;
      }
      case 'level_up': {
        // Rising arpeggio fanfare
        const notes2 = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes2.forEach((freq, i) => {
          const o = this.ctx.createOscillator(); o.type='triangle';
          o.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0, t + i * 0.09);
          g.gain.linearRampToValueAtTime(0.22, t + i * 0.09 + 0.04);
          g.gain.linearRampToValueAtTime(0.0, t + i * 0.09 + 0.28);
          const rev = this._makeReverb(1.5);
          o.connect(g); g.connect(rev); rev.connect(this.sfxGain);
          o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.35);
        });
        break;
      }
      case 'creature_kill': {
        const n = this._makeNoise(0.12);
        const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700;
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.25);
        n.connect(f); f.connect(g2); g2.connect(this.sfxGain); n.start(t);
        break;
      }
    }
  }

  playMusic(trackType) {
    this._ensureInit();
    this._stopMusic();
    const t = this.ctx.currentTime;
    const nodes = [];
    const configs = {
      surface:   { pads: [110,138.6,165,220],     arpNotes:[220,261.63,329.63,440],  bpm:60 },
      space:     { pads: [55, 69.3, 82.4,110],    arpNotes:[110,138.6,164.8,220],    bpm:50 },
      tense:     { pads: [73.4,87.3,110,146.8],   arpNotes:[146.8,174.6,220,293.7],  bpm:80 },
      discovery: { pads: [130.8,164.8,196,261.6], arpNotes:[261.6,329.6,392,523.3],  bpm:55 }
    };
    const cfg = configs[trackType] || configs.surface;
    const rev = this._makeReverb(4);
    rev.connect(this.musicGain);

    // Pads
    cfg.pads.forEach(freq => {
      const o = this.ctx.createOscillator(); o.type='sine';
      const lfo = this.ctx.createOscillator(); lfo.frequency.value=0.3;
      const lfog = this.ctx.createGain(); lfog.gain.value=2;
      lfo.connect(lfog); lfog.connect(o.frequency);
      o.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = 0.04;
      o.connect(g); g.connect(rev);
      o.start(t); lfo.start(t);
      nodes.push(o, g, lfo, lfog);
    });

    // Arp sequence
    const bps = cfg.bpm/60;
    const arpBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * (16/bps), this.ctx.sampleRate);
    const arpData = arpBuf.getChannelData(0);
    cfg.arpNotes.forEach((note, idx) => {
      const startSample = Math.floor(idx * (this.ctx.sampleRate / bps));
      const dur = Math.floor(this.ctx.sampleRate * 0.2);
      for (let i = 0; i < dur && startSample+i < arpData.length; i++) {
        arpData[startSample+i] = Math.sin(2*Math.PI*note*i/this.ctx.sampleRate) * (1 - i/dur) * 0.1;
      }
    });

    this._musicNodes = nodes;
  }

  _stopMusic() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this._musicNodes) {
      try { if(n.stop) n.stop(t+0.5); } catch(e){}
    }
    this._musicNodes = [];
  }

  setVolume(master, music, sfx) {
    this._ensureInit();
    if (master !== undefined) this.master.gain.value = master;
    if (music  !== undefined) this.musicGain.gain.value = music;
    if (sfx    !== undefined) this.sfxGain.gain.value = sfx;
  }

  update(dt, playerPos, sourcePositions) {
    // Simple distance-based volume adjustment for future use
  }

  dispose() {
    this.stopAmbient();
    this._stopMusic();
    this.playOneShot('jetpack_stop');
    this.playOneShot('ship_engine_stop');
    if (this.ctx) this.ctx.close();
  }
}
