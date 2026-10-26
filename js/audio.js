// Synthesised engine, boost, hits and goal horn (no audio files needed).
export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
  }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.connect(this.master);

    // Engine: two detuned saws through a lowpass.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
    this.engineFilter = lp;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.osc1.connect(lp); this.osc2.connect(lp);
    const o2g = ctx.createGain(); o2g.gain.value = 0.35;
    this.osc2.disconnect(); this.osc2.connect(o2g); o2g.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.osc1.start(); this.osc2.start();

    // Noise buffer shared by boost and impacts.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const boostSrc = ctx.createBufferSource();
    boostSrc.buffer = this.noise; boostSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    this.boostFilter = bp;
    this.boostGain = ctx.createGain(); this.boostGain.gain.value = 0;
    boostSrc.connect(bp); bp.connect(this.boostGain); this.boostGain.connect(this.fx);
    boostSrc.start();
    this.applyVolume();
  }

  applyVolume() {
    if (!this.ctx) return;
    const a = this.settings.audio;
    this.master.gain.value = a.master;
    this.fx.gain.value = a.effects;
    this.engineScale = a.engine;
  }

  update(car, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const speed = paused ? 0 : car.vel.length();
    const f = 48 + speed * 0.055 + (car.boosting ? 14 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(500 + speed * 0.9, t, 0.08);
    const eg = paused ? 0 : (0.05 + Math.min(1, speed / 2300) * 0.09) * this.engineScale;
    this.engineGain.gain.setTargetAtTime(eg, t, 0.08);
    this.boostGain.gain.setTargetAtTime(!paused && car.boosting ? 0.22 : 0, t, 0.04);
    this.boostFilter.frequency.setTargetAtTime(car.supersonic ? 2600 : 1400, t, 0.1);
  }

  burst(gain, freq, dur, type = 'lowpass', q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.fx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(freq, gain, dur, type = 'sine', slide = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.fx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  hit(strength) {
    this.burst(0.25 + strength * 0.6, 700 + strength * 2200, 0.18 + strength * 0.2);
    this.tone(120 + strength * 60, 0.2 + strength * 0.4, 0.2, 'sine', 0.5);
  }

  bounce(strength) { this.burst(0.1 + strength * 0.3, 500, 0.15); }
  jump() { this.burst(0.08, 900, 0.12, 'bandpass', 1.5); }
  flip() { this.burst(0.12, 1800, 0.2, 'bandpass', 0.7); }
  land(strength) { this.burst(0.05 + strength * 0.25, 300, 0.12); }
  pad(big) {
    this.tone(big ? 660 : 880, big ? 0.12 : 0.06, big ? 0.35 : 0.12, 'triangle', big ? 1.6 : 1.3);
  }

  goal() {
    this.burst(0.9, 600, 1.4);
    this.burst(0.5, 3000, 0.9, 'bandpass', 0.6);
    for (const [f, d] of [[220, 1.6], [277, 1.6], [330, 1.6]]) this.tone(f, 0.12, d, 'sawtooth', 1.0);
  }
}
