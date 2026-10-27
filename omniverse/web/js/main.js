// App controller: menus <-> matches, fixed 120 Hz simulation, rendering at the display rate.
import { World } from './sim/world.js';
import { AIController } from './sim/ai.js';
import { DT, DIFFICULTY } from './sim/constants.js';
import { emptyInput } from './sim/fighter.js';
import { ROSTER } from './data/roster.js';
import { ARENAS } from './data/arenas.js';
import { Renderer } from './render/renderer.js';
import { loadSprites } from './render/spriteset.js';
import { Input, MenuNav } from './input.js';
import { Audio } from './audio.js';
import { Save, cpuSetup } from './save.js';
import { Hud } from './ui/hud.js';
import { Menus, PLAYABLE } from './ui/menus.js';
import { TouchControls } from './ui/touch.js';
import { Intro, Versus } from './ui/intro.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.save = new Save();
    this.input = new Input(this.save.settings);
    this.audio = new Audio(this.save.settings);
    this.renderer = new Renderer(this.canvas);
    this.hud = new Hud();
    this.menus = new Menus(this, document.getElementById('ui'));
    this.nav = new MenuNav(this.input, () => this.menus.back());
    this.touch = new TouchControls(document.getElementById('touch-root'), this.input, () => this.togglePause());
    this.mode = 'menu';
    this.world = null;
    const list = PLAYABLE();
    const last = this.save.last;
    this.setup = last && list.some(c => c.id === last.p1) && list.some(c => c.id === last.p2) ? last : {
      p1: list[0].id, p1Skin: list[0].skins[0].id, p2: list[1].id, p2Skin: list[1].skins[0].id, arena: ARENAS[0].id, difficulty: 'medium',
    };
    this.acc = 0;
    this.fpsT = 0; this.frames = 0; this.fps = 0;
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => this.audio.unlock(), { capture: true });
    addEventListener('gamepadconnected', () => { this.audio.unlock(); this.applySettings(); if (this.mode === 'menu' && this.menus.current === 'title') this.menus.refresh(); });
    addEventListener('gamepaddisconnected', () => this.applySettings());
    addEventListener('resize', () => this.resize());
    addEventListener('androidback', () => {
      if (this.mode === 'fight' || this.mode === 'paused') this.togglePause();
      else if (this.mode === 'results') { this.toMenu(); this.menus.show('title'); }
      else this.menus.back();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'fight') this.pause(); });
    this.resize();
    this.applySettings();
    this.menuBackdrop();
    // Opening sequence, then the title menu.
    this.menus.hide();
    this.playSplash(new Intro(PLAYABLE(), this.audio), () => this.menus.show('title'));
    addEventListener('pointerdown', () => this.skipSplash());
    addEventListener('keydown', () => this.skipSplash());
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
  }

  applySettings() {
    this.renderer.showNumbers = this.save.settings.damageNumbers;
    const t = this.save.settings.touch;
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touchOn = t === 'on' || (t === 'auto' && touchCapable && !this.input.padConnected);
    this.touch.show(this.mode === 'fight' && this.touchOn);
  }

  // An AI-vs-AI exhibition plays behind the menus.
  menuBackdrop() {
    const list = PLAYABLE();
    const pick = () => list[Math.floor(Math.random() * list.length)];
    const a = pick(); let b = pick(); if (b === a) b = list[(list.indexOf(a) + 1) % list.length];
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
    this.world = new World({ arena, players: [cpuSetup(a, a.skins[0], 'hard'), cpuSetup(b, b.skins[0], 'hard')], roundsToWin: 99 });
    this.ais = [new AIController(this.world, this.world.fighters[0], 'hard'), new AIController(this.world, this.world.fighters[1], 'hard')];
    this.renderer.bind(this.world);
  }

  playSplash(splash, then) { this.splash = splash; this.splashThen = then; this.splashAge = 0; }

  skipSplash() { if (this.splash && this.splashAge > 0.25) this.splash.skip(); }

  // Show the versus splash, then fight.
  startMatch() {
    const s = this.setup;
    const c1 = ROSTER.find(c => c.id === s.p1), c2 = ROSTER.find(c => c.id === s.p2);
    const arena = ARENAS.find(x => x.id === s.arena) || ARENAS[0];
    this.menus.hide();
    this.touch.show(false);
    this.mode = 'versus';
    this.playSplash(new Versus(c1, s.p1Skin, c2, s.p2Skin, arena.name, DIFFICULTY[s.difficulty].label, this.audio), () => this.beginMatch());
  }

  beginMatch() {
    const s = this.setup, sv = this.save;
    const c1 = ROSTER.find(c => c.id === s.p1), c2 = ROSTER.find(c => c.id === s.p2);
    const k1 = c1.skins.find(k => k.id === s.p1Skin) || c1.skins[0], k2 = c2.skins.find(k => k.id === s.p2Skin) || c2.skins[0];
    sv.char(c1).skin = k1.id;
    sv.remember({ ...s });
    const arena = ARENAS.find(x => x.id === s.arena) || ARENAS[0];
    const p2 = cpuSetup(c2, k2, s.difficulty);
    p2.dmgFactor = DIFFICULTY[s.difficulty].damage;
    this.world = new World({ arena, players: [sv.playerSetup(c1, k1), p2] });
    this.ais = [null, new AIController(this.world, this.world.fighters[1], s.difficulty)];
    this.renderer.bind(this.world);
    this.hud = new Hud();
    this.mode = 'fight';
    this.resultShown = false;
    this.acc = 0;
    this.menus.hide();
    this.applySettings();
  }

  togglePause() { if (this.mode === 'fight') this.pause(); else if (this.mode === 'paused') this.resume(); }
  pause() { if (this.mode !== 'fight') return; this.mode = 'paused'; this.touch.show(false); this.menus.show('pause'); this.audio.play('back'); }
  resume() { this.mode = 'fight'; this.menus.hide(); this.applySettings(); this.last = performance.now(); this.audio.play('ok'); }
  quit() { this.toMenu(); this.menus.show('title'); }
  toMenu() { this.mode = 'menu'; this.touch.show(false); this.menuBackdrop(); }

  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }

    if (this.splash) {
      this.splashAge += dt;
      const pad = this.input.pad();
      if (pad && pad.buttons.some(b => b.pressed)) this.skipSplash();
      this.splash.update(dt);
      this.splash.draw(this.renderer.ctx);
      if (this.splash.done) { const then = this.splashThen; this.splash = null; then(); this.nav.swallow = true; }
      return;
    }
    if (this.mode !== 'fight') this.nav.update(dt, document.getElementById('ui'));
    if (this.input.consumePause()) {
      if (this.mode === 'fight' || this.mode === 'paused') this.togglePause();
      else if (this.mode === 'menu') this.menus.back();
    }

    const w = this.world;
    let worldDt = 0;
    if (this.mode !== 'paused') {
      this.acc += dt * w.slowScale;
      let steps = 0;
      while (this.acc >= DT && steps < 24) {
        const p1 = this.mode === 'fight' ? this.input.poll() : this.ais[0] ? this.ais[0].input() : emptyInput();
        w.step([p1, this.ais[1].input()]);
        this.acc -= DT; worldDt += DT; steps++;
      }
      if (steps === 24) this.acc = 0;
    }
    if (this.mode === 'fight') {
      this.audio.events(w.events, w.fighters[0]);
      for (const e of w.events) {
        if (e.type === 'hit' && e.f === w.fighters[0]) this.input.rumble(Math.min(1, e.dmg / 120), 0.6, 90 + e.dmg);
        if (e.type === 'hit' && e.a?.owner === w.fighters[0]) this.input.rumble(0, Math.min(0.6, e.dmg / 150), 50);
        if (e.type === 'matchEnd') setTimeout(() => this.finish(e.winner === 0), 1800);
      }
    }
    this.renderer.render(dt, worldDt);
    if (this.mode === 'fight' || this.mode === 'paused') {
      this.hud.update(dt, w, 0);
      this.hud.draw(this.renderer.ctx, w, 0, { showSlots: !this.touchOn, fps: this.save.settings.showFps ? this.fps : 0 });
      this.touch.update(w.fighters[0]);
    } else if (w.phase === 'matchEnd' || w.round > 6) {
      this.menuBackdrop();
    }
  }

  finish(won) {
    if (this.mode !== 'fight' || this.resultShown) return;
    this.resultShown = true;
    const c = ROSTER.find(x => x.id === this.setup.p1);
    const pts = this.save.reward(c, won, this.setup.difficulty);
    this.audio.play(won ? 'win' : 'lose');
    this.mode = 'results';
    this.touch.show(false);
    this.menus.show('results', won, pts);
  }
}

document.fonts?.load('16px "Press Start 2P"').finally(() => loadSprites().then(() => { window.app = new App(); }));
