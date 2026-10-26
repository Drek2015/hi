// Synthesised golf sounds: putts, rail knocks, bumpers, cup rattles and fanfares.
export class Sfx {
  constructor() { this.ctx = null; this.enabled = true; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  tone(f, g, dur, type = 'sine', slide = 1, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), a = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }

  noiseHit(g, freq, dur, type = 'bandpass', q = 2, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const a = this.ctx.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(a); a.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  putt(power) { this.noiseHit(0.5 + power * 0.4, 2400, 0.08, 'bandpass', 3); this.tone(900 + power * 300, 0.12, 0.06, 'triangle', 0.6); }
  wall(v) { const g = Math.min(0.5, v / 10); this.noiseHit(g, 900, 0.09, 'bandpass', 4); this.tone(220, g * 0.5, 0.08, 'sine', 0.7); }
  bumper() { this.tone(520, 0.25, 0.25, 'sine', 1.8); this.tone(260, 0.15, 0.2, 'triangle', 1.5); }
  spinner() { this.noiseHit(0.3, 600, 0.12, 'lowpass', 1); }
  boost() { this.tone(300, 0.15, 0.3, 'sawtooth', 3); }
  portal() { this.tone(200, 0.2, 0.45, 'sine', 6); this.tone(800, 0.08, 0.45, 'triangle', 0.3); }
  cup(rival = false) {
    const g = rival ? 0.12 : 0.35;
    this.noiseHit(g, 3000, 0.05, 'bandpass', 6);
    this.noiseHit(g * 0.8, 2600, 0.05, 'bandpass', 6, 0.07);
    this.tone(180, g, 0.25, 'sine', 0.5, 0.12);
  }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 0.35, 'triangle', 1, i * 0.11)); }
  click() { this.tone(1200, 0.05, 0.04, 'square', 0.8); }
}
