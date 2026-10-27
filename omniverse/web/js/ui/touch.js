// On-screen controls: a floating stick on the left half, action buttons on the right.
const BUTTONS = [
  ['jump', 'JUMP', 'b-jump'], ['light', 'ATK', 'b-light'], ['heavy', 'HVY', 'b-heavy'],
  ['ab0', '1', 'b-ab0'], ['ab1', '2', 'b-ab1'], ['ab2', '3', 'b-ab2'], ['ab3', 'ULT', 'b-ult'],
  ['guard', 'GRD', 'b-guard'], ['dash', 'DASH', 'b-dash'],
];

export class TouchControls {
  constructor(root, input, onPause) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `<div class="stick-zone"><div class="stick"><div class="knob"></div></div></div>
      <div class="pad">${BUTTONS.map(([a, label, cls]) => `<div class="tbtn ${cls}" data-a="${a}"><span>${label}</span></div>`).join('')}</div>
      <div class="tpause">II</div>`;
    root.append(this.el);
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.knob');
    this.stickId = null;
    const zone = this.el.querySelector('.stick-zone');
    zone.addEventListener('pointerdown', e => this.stickStart(e));
    zone.addEventListener('pointermove', e => this.stickMove(e));
    zone.addEventListener('pointerup', e => this.stickEnd(e));
    zone.addEventListener('pointercancel', e => this.stickEnd(e));
    for (const b of this.el.querySelectorAll('.tbtn')) {
      const a = b.dataset.a;
      const on = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); this.input.touch.buttons.add(a); b.classList.add('on'); this.input.lastDevice = 'touch'; navigator.vibrate?.(8); };
      const off = e => { e.preventDefault(); this.input.touch.buttons.delete(a); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
    }
    this.el.querySelector('.tpause').addEventListener('pointerdown', e => { e.preventDefault(); onPause(); });
  }

  stickStart(e) {
    e.preventDefault();
    if (this.stickId !== null) return;
    this.stickId = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = this.el.getBoundingClientRect();
    this.cx = e.clientX; this.cy = e.clientY;
    this.stick.style.left = `${e.clientX - r.left}px`;
    this.stick.style.top = `${e.clientY - r.top}px`;
    this.stick.classList.add('on');
    this.input.lastDevice = 'touch';
    this.stickMove(e);
  }

  stickMove(e) {
    if (e.pointerId !== this.stickId) return;
    const R = Math.min(70, innerHeight * 0.13);
    let dx = (e.clientX - this.cx) / R, dy = (e.clientY - this.cy) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    this.knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    const dz = 0.22;
    this.input.touch.x = Math.abs(dx) > dz ? dx : 0;
    this.input.touch.y = Math.abs(dy) > dz + 0.15 ? dy : 0;
  }

  stickEnd(e) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.input.touch.x = 0; this.input.touch.y = 0;
    this.knob.style.transform = '';
    this.stick.classList.remove('on');
  }

  show(on) { this.el.style.display = on ? '' : 'none'; if (!on) { this.input.touch.buttons.clear(); this.input.touch.x = this.input.touch.y = 0; } }

  // Dim ability buttons that can't be used right now.
  update(f) {
    if (!f || this.el.style.display === 'none') return;
    for (let i = 0; i < 4; i++) {
      const b = this.el.querySelector(`[data-a="ab${i}"]`);
      const def = f.slots[i];
      const ready = def && f.cooldowns[i] <= 0 && (i === 3 ? f.ult >= 100 : f.energy >= (def.cost ?? 0));
      b.classList.toggle('dim', !ready);
      const label = def ? (i === 3 ? 'ULT' : def.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3)) : '-';
      if (b.firstChild.textContent !== label) b.firstChild.textContent = label;
    }
  }
}
