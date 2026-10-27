// Synthesised sound effects (no audio files): short noise and oscillator envelopes.
import { fxInfo } from './render/fx.js';
export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.last = new Map();
  }

  // Browsers only allow audio after a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ok() { return this.ctx && this.settings.sfx > 0; }

  noise(dur, { vol = 0.5, f0 = 2000, f1 = 400, q = 0.8, type = 'lowpass', delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const flt = c.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol * this.settings.sfx, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  tone(dur, { vol = 0.3, f0 = 440, f1 = f0, type = 'square', delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * this.settings.sfx, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Avoid stacking the same sound many times in one instant.
  gate(name, gap = 0.03) {
    const now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < gap) return false;
    this.last.set(name, now);
    return true;
  }

  play(name, k = 1) {
    if (!this.ok || !this.gate(name)) return;
    switch (name) {
      case 'hit': this.noise(0.09 + 0.06 * k, { vol: 0.35 + 0.25 * k, f0: 3000, f1: 300 }); this.tone(0.08, { vol: 0.25 * k, f0: 160, f1: 60, type: 'sine' }); break;
      case 'heavy': this.noise(0.2, { vol: 0.7, f0: 1800, f1: 120 }); this.tone(0.18, { vol: 0.5, f0: 120, f1: 40, type: 'sine' }); break;
      case 'guard': this.tone(0.06, { vol: 0.2, f0: 900, f1: 600 }); this.noise(0.05, { vol: 0.2, f0: 5000, f1: 2000, type: 'highpass' }); break;
      case 'parry': this.tone(0.25, { vol: 0.25, f0: 1400, f1: 1800, type: 'triangle' }); break;
      case 'break': this.noise(0.3, { vol: 0.6, f0: 4000, f1: 200 }); this.tone(0.3, { vol: 0.3, f0: 600, f1: 90 }); break;
      case 'swing': this.noise(0.08, { vol: 0.15 * k, f0: 1200, f1: 4000, type: 'bandpass', q: 2 }); break;
      case 'jump': this.tone(0.1, { vol: 0.12, f0: 300, f1: 600, type: 'triangle' }); break;
      case 'land': this.noise(0.06, { vol: 0.15, f0: 600, f1: 100 }); break;
      case 'dash': this.noise(0.15, { vol: 0.25, f0: 800, f1: 3000, type: 'bandpass', q: 1.5 }); break;
      case 'cast': this.tone(0.18, { vol: 0.15, f0: 300, f1: 900, type: 'sawtooth' }); break;
      case 'boom': this.noise(0.5, { vol: 0.8, f0: 1400, f1: 60 }); this.tone(0.4, { vol: 0.5, f0: 90, f1: 30, type: 'sine' }); break;
      case 'zap': this.noise(0.25, { vol: 0.35, f0: 6000, f1: 2500, type: 'highpass' }); this.tone(0.2, { vol: 0.15, f0: 1200, f1: 300, type: 'sawtooth' }); break;
      case 'ultimate': [0, 0.08, 0.16].forEach((d, i) => this.tone(0.6, { vol: 0.18, f0: [220, 277, 330][i], f1: [440, 554, 660][i], type: 'sawtooth', delay: d })); this.noise(0.8, { vol: 0.4, f0: 300, f1: 3000, type: 'bandpass' }); break;
      case 'transform': this.tone(0.5, { vol: 0.2, f0: 150, f1: 900, type: 'sawtooth' }); this.noise(0.6, { vol: 0.35, f0: 400, f1: 4000, type: 'bandpass' }); break;
      case 'ko': this.noise(0.8, { vol: 0.9, f0: 900, f1: 40 }); this.tone(0.7, { vol: 0.5, f0: 200, f1: 35, type: 'sine' }); break;
      case 'round': this.tone(0.15, { vol: 0.2, f0: 660 }); this.tone(0.3, { vol: 0.2, f0: 880, delay: 0.15 }); break;
      case 'fight': this.tone(0.12, { vol: 0.25, f0: 523 }); this.tone(0.12, { vol: 0.25, f0: 659, delay: 0.1 }); this.tone(0.35, { vol: 0.25, f0: 784, delay: 0.2 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(0.25, { vol: 0.2, f0: f, delay: i * 0.12 })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(0.35, { vol: 0.2, f0: f, delay: i * 0.18, type: 'triangle' })); break;
      case 'whir': for (let i = 0; i < 6; i++) this.tone(0.09, { vol: 0.1, f0: 300 + i * 90, f1: 500 + i * 120, type: 'sawtooth', delay: i * 0.05 }); this.noise(0.4, { vol: 0.2, f0: 1500, f1: 4000, type: 'bandpass', q: 3 }); break;
      case 'charge': this.tone(0.5, { vol: 0.15, f0: 120, f1: 700, type: 'sawtooth' }); this.noise(0.5, { vol: 0.2, f0: 300, f1: 3000, type: 'bandpass', q: 2 }); break;
      case 'flame': this.noise(0.45, { vol: 0.45, f0: 800, f1: 200 }); break;
      case 'throw': this.noise(0.12, { vol: 0.25, f0: 2500, f1: 6000, type: 'bandpass', q: 4 }); break;
      case 'ui': this.tone(0.04, { vol: 0.12, f0: 880 }); break;
      case 'ok': this.tone(0.07, { vol: 0.15, f0: 660, f1: 990 }); break;
      case 'back': this.tone(0.07, { vol: 0.15, f0: 520, f1: 330 }); break;
      case 'deny': this.tone(0.12, { vol: 0.15, f0: 180, f1: 140 }); break;
    }
  }

  // Map world events to sounds.
  events(events, player) {
    if (!this.ok) return;
    for (const e of events) {
      switch (e.type) {
        case 'hit': this.play(e.heavy || e.dmg > 90 ? 'heavy' : 'hit', Math.min(1, e.dmg / 80)); break;
        case 'guard': case 'shieldHit': this.play('guard'); break;
        case 'parry': case 'counter': this.play('parry'); break;
        case 'guardBreak': this.play('break'); break;
        case 'swing': this.play('swing', e.heavy ? 1 : 0.6); break;
        case 'jump': if (e.f === player) this.play('jump'); break;
        case 'land': if (e.f === player) this.play('land'); break;
        case 'dash': case 'teleport': this.play('dash'); break;
        case 'cast': {
          // Each kind of jutsu or power gets its own sound.
          const st = fxInfo(e.def.fx).style;
          const k = st === 'bolt' || st === 'beamBolt' || st === 'pillar' ? 'zap' : st === 'spiral' ? 'whir' : st === 'beam' ? 'charge'
            : st === 'fire' || st === 'beamFire' ? 'flame' : st === 'blade' || st === 'star' || st === 'needle' ? 'throw' : 'cast';
          this.play(k);
          break;
        }
        case 'burst': case 'strike': if (e.big || e.type === 'strike') this.play('boom'); break;
        case 'clash': this.play('boom'); break;
        case 'ultimate': this.play('ultimate'); break;
        case 'transform': this.play('transform'); break;
        case 'ko': this.play('ko'); break;
        case 'roundStart': this.play('round'); break;
        case 'fight': this.play('fight'); break;
      }
    }
  }
}
