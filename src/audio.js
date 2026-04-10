/**
 * src/audio.js  –  Web Audio API procedural sound engine (AAA pass)
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this._ambientNodes = [];
    this._musicNodes = [];
    this._windNode = null;
    this._windGain = null;
    this._jetpackOsc = null;
    this._shipOsc = null;
    this._currentTrack = null;
    this._crossfadeTimer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.45;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.35;
    this.ambientGain.connect(this.master);
    this.initialized = true;
  }

  _ensureInit() { if (!this.initialized) this.init(); }

  _makeReverb(duration = 1.5, decay = 2.0) {
    const len = Math.ceil(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, decay);
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

  /** Play looped wind ambient. Call setWindIntensity() to adjust volume. */
  startWind(freq = 600) {
    this._ensureInit();
    if (this._windNode) return;
    const t = this.ctx.currentTime;
    // Long noise buffer (10s looped)
    const len = this.ctx.sampleRate * 10;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 0.8;
    const filt2 = this.ctx.createBiquadFilter();
    filt2.type = 'highpass'; filt2.frequency.value = freq * 0.3;
    this._windGain = this.ctx.createGain();
    this._windGain.gain.value = 0.0;
    src.connect(filt); filt.connect(filt2); filt2.connect(this._windGain);
    this._windGain.connect(this.ambientGain);
    src.start(t);
    this._windNode = src;
  }

  setWindIntensity(normalised) {
    // normalised 0..1
    if (!this._windGain) return;
    const vol = normalised * 0.18;
    this._windGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
  }

  stopWind() {
    if (this._windNode) {
      try { this._windNode.stop(); } catch(e) {}
      this._windNode = null;
      this._windGain = null;
    }
  }

  playAmbient(biomeType) {
    this._ensureInit();
    this.stopAmbient();
    const t = this.ctx.currentTime;
    const nodes = [];

    const drones = {
      LUSH:55, BARREN:45, TOXIC:60, FROZEN:50, BURNING:65, EXOTIC:70, DEAD:40, OCEAN:52,
      TROPICAL:58, ARCTIC:48, VOLCANIC:68, SWAMP:56, DESERT:47, CRYSTAL:75
    };

    // Base drone (sine + slight detuned sub)
    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = drones[biomeType] || 50;
    const dg = this.ctx.createGain(); dg.gain.value = 0.06;
    drone.connect(dg); dg.connect(this.ambientGain);
    drone.start(t); nodes.push(drone, dg);

    // Sub bass
    const sub = this.ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = (drones[biomeType] || 50) * 0.5;
    const sg = this.ctx.createGain(); sg.gain.value = 0.04;
    sub.connect(sg); sg.connect(this.ambientGain);
    sub.start(t); nodes.push(sub, sg);

    // Wind noise layer
    const noise = this._makeNoise(999);
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = biomeType === 'TOXIC' ? 800
                           : biomeType === 'FROZEN' || biomeType === 'ARCTIC' ? 350
                           : biomeType === 'VOLCANIC' ? 1200
                           : 550;
    filter.Q.value = 0.5;
    const ng = this.ctx.createGain(); ng.gain.value = 0.05;
    noise.connect(filter); filter.connect(ng); ng.connect(this.ambientGain);
    noise.start(t); nodes.push(noise, filter, ng);

    // Exotic bioluminescent pulse
    if (biomeType === 'EXOTIC' || biomeType === 'CRYSTAL') {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = biomeType === 'CRYSTAL' ? 440 : 220;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.4;
      const lfog = this.ctx.createGain(); lfog.gain.value = 0.05;
      lfo.connect(lfog); lfog.connect(osc.frequency);
      const og = this.ctx.createGain(); og.gain.value = 0.04;
      osc.connect(og); og.connect(this.ambientGain);
      osc.start(t); lfo.start(t); nodes.push(osc, og, lfo, lfog);
    }

    // Volcanic lava bubble rumble
    if (biomeType === 'VOLCANIC' || biomeType === 'BURNING') {
      const rumble = this.ctx.createOscillator();
      rumble.type = 'sawtooth'; rumble.frequency.value = 30;
      const lfo2 = this.ctx.createOscillator(); lfo2.frequency.value = 0.15;
      const lfog2 = this.ctx.createGain(); lfog2.gain.value = 8;
      lfo2.connect(lfog2); lfog2.connect(rumble.frequency);
      const rg = this.ctx.createGain(); rg.gain.value = 0.06;
      const rfilt = this.ctx.createBiquadFilter(); rfilt.type='lowpass'; rfilt.frequency.value=200;
      rumble.connect(rfilt); rfilt.connect(rg); rg.connect(this.ambientGain);
      rumble.start(t); lfo2.start(t); nodes.push(rumble, rg, lfo2, lfog2, rfilt);
    }

    // Ocean waves
    if (biomeType === 'OCEAN' || biomeType === 'TROPICAL') {
      const wave = this._makeNoise(999);
      wave.loop = true;
      const wfilt = this.ctx.createBiquadFilter(); wfilt.type='lowpass'; wfilt.frequency.value=300;
      const wg = this.ctx.createGain(); wg.gain.value = 0.07;
      wave.connect(wfilt); wfilt.connect(wg); wg.connect(this.ambientGain);
      wave.start(t); nodes.push(wave, wfilt, wg);
    }

    this._ambientNodes = nodes;
    // Start wind layer
    const windFreqs = { FROZEN:350, ARCTIC:300, DESERT:700, BARREN:600 };
    this.startWind(windFreqs[biomeType] || 550);
  }

  stopAmbient() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this._ambientNodes) {
      try { if (n.stop) n.stop(t + 0.3); } catch(e) {}
    }
    this._ambientNodes = [];
    this.stopWind();
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
        // Chip impact
        const n = this._makeNoise(0.04);
        const nf = this.ctx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=1200;
        const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.08,t); ng.gain.linearRampToValueAtTime(0.0,t+0.04);
        n.connect(nf); nf.connect(ng); ng.connect(this.sfxGain); n.start(t);
        break;
      }
      case 'footstep': {
        const n = this._makeNoise(0.07);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 250; f.Q.value = 1.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.1, t);
        g.gain.linearRampToValueAtTime(0.0, t + 0.07);
        n.connect(f); f.connect(g); g.connect(this.sfxGain);
        n.start(t);
        break;
      }
      case 'jetpack': {
        if (!this._jetpackOsc) {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = 800;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 25;
          const lfog = this.ctx.createGain(); lfog.gain.value = 120;
          lfo.connect(lfog); lfog.connect(o.frequency);
          const g = this.ctx.createGain(); g.gain.value = 0.09;
          const filt = this.ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=3500;
          o.connect(filt); filt.connect(g); g.connect(this.sfxGain);
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
          const o2 = this.ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=165;
          const g = this.ctx.createGain(); g.gain.value=0.1;
          const filt = this.ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=2000;
          o1.connect(filt); o2.connect(filt); filt.connect(g); g.connect(this.sfxGain);
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
        o.frequency.setValueAtTime(80, t);
        o.frequency.exponentialRampToValueAtTime(4500, t+1.8);
        o.frequency.exponentialRampToValueAtTime(40, t+2.8);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, t);
        g.gain.linearRampToValueAtTime(0.5, t+0.5);
        g.gain.linearRampToValueAtTime(0.0, t+2.8);
        const rev = this._makeReverb(4, 3);
        o.connect(g); g.connect(rev); rev.connect(this.sfxGain);
        o.start(t); o.stop(t+2.9);
        // Sub thump
        const sub = this.ctx.createOscillator(); sub.type='sine'; sub.frequency.value=35;
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.5,t); sg.gain.exponentialRampToValueAtTime(0.001,t+1.2);
        sub.connect(sg); sg.connect(this.sfxGain); sub.start(t); sub.stop(t+1.2);
        break;
      }
      case 'discovery': {
        const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
        const rev = this._makeReverb(2.5);
        rev.connect(this.sfxGain);
        notes.forEach((freq, i) => {
          const o = this.ctx.createOscillator(); o.type='triangle';
          o.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0, t+i*0.10);
          g.gain.linearRampToValueAtTime(0.18, t+i*0.10+0.04);
          g.gain.linearRampToValueAtTime(0.0, t+i*0.10+0.35);
          o.connect(g); g.connect(rev);
          o.start(t+i*0.10); o.stop(t+i*0.10+0.4);
        });
        break;
      }
      case 'hit': {
        const n = this._makeNoise(0.12);
        const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0.0, t+0.12);
        n.connect(f); f.connect(g); g.connect(this.sfxGain); n.start(t);
        break;
      }
      case 'death': {
        const o = this.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(280,t); o.frequency.linearRampToValueAtTime(40,t+1.8);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.35,t); g.gain.linearRampToValueAtTime(0.0,t+1.8);
        const rev = this._makeReverb(3);
        o.connect(g); g.connect(rev); rev.connect(this.sfxGain);
        o.start(t); o.stop(t+1.9);
        break;
      }
      case 'ui_click': {
        const o = this.ctx.createOscillator(); o.type='sine'; o.frequency.value=1100;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06,t); g.gain.linearRampToValueAtTime(0.0,t+0.06);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t+0.07);
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
        const o = this.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(900, t);
        o.frequency.exponentialRampToValueAtTime(110, t+0.20);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t); g.gain.linearRampToValueAtTime(0.0, t+0.22);
        const filter = this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=3500;
        o.connect(filter); filter.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t+0.24);
        break;
      }
      case 'level_up': {
        const notes2 = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        const rev2 = this._makeReverb(2.0);
        rev2.connect(this.sfxGain);
        notes2.forEach((freq, i) => {
          const o = this.ctx.createOscillator(); o.type='triangle';
          o.frequency.value = freq;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0, t + i * 0.09);
          g.gain.linearRampToValueAtTime(0.22, t + i * 0.09 + 0.04);
          g.gain.linearRampToValueAtTime(0.0, t + i * 0.09 + 0.28);
          o.connect(g); g.connect(rev2);
          o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.35);
        });
        break;
      }
      case 'creature_kill': {
        const n = this._makeNoise(0.14);
        const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700;
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.28);
        n.connect(f); f.connect(g2); g2.connect(this.sfxGain); n.start(t);
        break;
      }
      case 'creature_growl': {
        // Low growl
        const o = this.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(80,t); o.frequency.linearRampToValueAtTime(60,t+0.5);
        const lfo = this.ctx.createOscillator(); lfo.frequency.value=5;
        const lfog = this.ctx.createGain(); lfog.gain.value=12;
        lfo.connect(lfog); lfog.connect(o.frequency);
        const filt = this.ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0,t); g.gain.linearRampToValueAtTime(0.18,t+0.08);
        g.gain.linearRampToValueAtTime(0.0,t+0.5);
        o.connect(filt); filt.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t+0.55); lfo.start(t); lfo.stop(t+0.55);
        break;
      }
      case 'lava_crack': {
        const n = this._makeNoise(0.3);
        const filt = this.ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=500;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
        n.connect(filt); filt.connect(g); g.connect(this.sfxGain); n.start(t);
        break;
      }
      case 'radiation_hum': {
        const o = this.ctx.createOscillator(); o.type='square'; o.frequency.value=1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.03,t); g.gain.linearRampToValueAtTime(0.0,t+0.5);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t+0.5);
        break;
      }
    }
  }

  /** Play looped, evolving music track. Cross-fades if a track is already playing. */
  playMusic(trackType) {
    this._ensureInit();
    if (this._currentTrack === trackType) return;
    // Fade out old track
    const fadeTime = 2.0;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(0, t, 0.5);
    clearTimeout(this._crossfadeTimer);
    this._crossfadeTimer = setTimeout(() => {
      this._stopMusic();
      this._startMusicTrack(trackType);
      this.musicGain.gain.setTargetAtTime(0.45, this.ctx.currentTime, 0.8);
      this._currentTrack = trackType;
    }, fadeTime * 1000);
    if (!this._musicNodes.length) {
      // No existing music — start immediately
      clearTimeout(this._crossfadeTimer);
      this._stopMusic();
      this._startMusicTrack(trackType);
      this.musicGain.gain.setTargetAtTime(0.45, t, 1.0);
      this._currentTrack = trackType;
    }
  }

  _startMusicTrack(trackType) {
    const t = this.ctx.currentTime;
    const nodes = [];
    const rev = this._makeReverb(5, 2.5);
    rev.connect(this.musicGain);

    const configs = {
      surface:   { pads:[110,138.6,165,220],     arpNotes:[220,261.63,329.63,440],   bpm:55, pad:'sine'    },
      space:     { pads:[55, 69.3, 82.4,110],    arpNotes:[110,138.6,164.8,220],     bpm:48, pad:'sine'    },
      tense:     { pads:[73.4,87.3,110,146.8],   arpNotes:[146.8,174.6,220,293.7],   bpm:78, pad:'sawtooth'},
      discovery: { pads:[130.8,164.8,196,261.6], arpNotes:[261.6,329.6,392,523.3],   bpm:55, pad:'triangle'},
      volcanic:  { pads:[55,65.4,73.4,82.4],     arpNotes:[164.8,196,220,261.6],     bpm:72, pad:'sawtooth'},
      crystal:   { pads:[220,277.2,330,440],     arpNotes:[440,554.4,659.3,880],     bpm:52, pad:'sine'    },
    };
    const cfg = configs[trackType] || configs.surface;

    // Pads with slow LFO vibrato
    cfg.pads.forEach((freq, idx) => {
      const o = this.ctx.createOscillator();
      o.type = cfg.pad;
      o.frequency.value = freq;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.25 + idx * 0.04;
      const lfog = this.ctx.createGain(); lfog.gain.value = 1.5;
      lfo.connect(lfog); lfog.connect(o.frequency);
      const g = this.ctx.createGain(); g.gain.value = 0.04;
      o.connect(g); g.connect(rev);
      o.start(t); lfo.start(t);
      nodes.push(o, g, lfo, lfog);
    });

    // Arp sequence using scheduled oscillators that loop every bar
    const bps = cfg.bpm / 60;
    const barDur = 4 / bps; // 4 beats
    const scheduleArp = () => {
      const now = this.ctx.currentTime;
      cfg.arpNotes.forEach((note, idx) => {
        const startAt = now + idx * (1/bps);
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = note;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, startAt);
        g.gain.linearRampToValueAtTime(0.08, startAt + 0.03);
        g.gain.linearRampToValueAtTime(0.0, startAt + 0.18);
        o.connect(g); g.connect(rev);
        o.start(startAt); o.stop(startAt + 0.22);
        nodes.push(o, g);
      });
    };
    scheduleArp();
    // Loop arp every bar
    this._arpInterval = setInterval(scheduleArp, barDur * 1000);
    nodes.push({ stop: () => clearInterval(this._arpInterval) });

    this._musicNodes = nodes;
  }

  _stopMusic() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this._musicNodes) {
      try { if (n.stop) n.stop(t + 0.5); } catch(e) {}
    }
    this._musicNodes = [];
    this._currentTrack = null;
  }

  setVolume(master, music, sfx) {
    this._ensureInit();
    if (master !== undefined) this.master.gain.value = master;
    if (music  !== undefined) this.musicGain.gain.value = music;
    if (sfx    !== undefined) this.sfxGain.gain.value = sfx;
  }

  update(dt, weatherIntensity) {
    if (!this.initialized) return;
    // Drive wind volume from weather intensity (0..1)
    if (weatherIntensity != null) {
      this.setWindIntensity(weatherIntensity);
    }
  }

  dispose() {
    this.stopAmbient();
    this._stopMusic();
    clearTimeout(this._crossfadeTimer);
    this.playOneShot('jetpack_stop');
    this.playOneShot('ship_engine_stop');
    if (this.ctx) this.ctx.close();
  }
}
