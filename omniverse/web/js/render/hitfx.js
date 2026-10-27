// Impact effects in the style of arcade fighters: stepped, punchy frames rather than soft fades.
// Drawn in world units on the effects layer (which is rendered at art resolution).

const FRAME = 1 / 30;   // effects animate on 30 fps frames for a crisp, hand-animated read

function burstPath(ctx, x, y, r, inner, points, rot) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * inner : r * (0.85 + ((i * 37) % 7) / 20);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export class HitFx {
  constructor() { this.list = []; }

  // kind: 'light' | 'heavy' | 'crit' | 'guard' | 'parry' | 'clash'
  add(kind, x, y, dir = 1, color = '#ffffff') {
    const life = { light: 0.17, heavy: 0.27, crit: 0.3, guard: 0.16, parry: 0.3, clash: 0.32 }[kind] ?? 0.2;
    this.list.push({ kind, x, y, dir, color, t: 0, life, rot: Math.random() * Math.PI, seed: Math.random() });
  }

  update(dt) {
    for (const h of this.list) h.t += dt;
    this.list = this.list.filter(h => h.t < h.life);
  }

  draw(ctx) {
    ctx.save();
    for (const h of this.list) {
      ctx.save(); ctx.translate(h.x, h.y); const sc = h.kind === 'parry' || h.kind === 'clash' ? 0.85 : 1.35; ctx.scale(sc, sc); ctx.translate(-h.x, -h.y);
      const f = Math.floor(h.t / FRAME);              // stepped frame index
      const u = h.t / h.life;
      switch (h.kind) {
        case 'light': this.light(ctx, h, f, u); break;
        case 'heavy': case 'crit': this.heavy(ctx, h, f, u); break;
        case 'guard': this.guard(ctx, h, f, u); break;
        case 'parry': case 'clash': this.parry(ctx, h, f, u); break;
      }
      ctx.restore();
    }
    ctx.restore();
  }

  light(ctx, h, f, u) {
    const r = [26, 40, 46, 34, 0][Math.min(4, f)];
    if (!r) return;
    ctx.globalCompositeOperation = 'source-over';
    burstPath(ctx, h.x, h.y, r, 0.38, 5, h.rot);
    ctx.fillStyle = f === 0 ? '#ffffff' : h.color; ctx.fill();
    if (f >= 1) { burstPath(ctx, h.x, h.y, r * 0.55, 0.45, 5, h.rot + 0.4); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    // Short streaks thrown along the hit direction.
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'square';
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.5 + (h.dir > 0 ? 0 : Math.PI);
      const d0 = 30 + f * 18, d1 = d0 + 26 - f * 4;
      ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * d0, h.y + Math.sin(a) * d0); ctx.lineTo(h.x + Math.cos(a) * d1, h.y + Math.sin(a) * d1); ctx.stroke();
    }
  }

  heavy(ctx, h, f, u) {
    const col = h.kind === 'crit' ? '#ffd23a' : h.color;
    const r = [50, 78, 92, 88, 70, 46, 24, 0][Math.min(7, f)];
    // Shock ring
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 12 - f * 1.5);
    ctx.beginPath(); ctx.arc(h.x, h.y, 40 + f * 26, 0, Math.PI * 2); ctx.stroke();
    if (r) {
      burstPath(ctx, h.x, h.y, r, 0.32, 7, h.rot);
      ctx.fillStyle = f < 2 ? '#ffffff' : col; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#120a1a'; ctx.stroke();
      burstPath(ctx, h.x, h.y, r * 0.5, 0.4, 7, h.rot + 0.3);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    // A slash streak through the impact in the hit direction.
    if (f < 5) {
      const len = 120 + f * 40, w = 18 - f * 3;
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate((h.dir > 0 ? 0 : Math.PI) + (h.seed - 0.5) * 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-len * 0.5, 0); ctx.lineTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Debris squares flying out
    ctx.fillStyle = col;
    for (let i = 0; i < 8; i++) {
      const a = h.rot + i * 0.785 + h.seed;
      const d = 30 + h.t * (500 + (i % 3) * 180);
      const sz = Math.max(4, 12 - f * 1.4);
      ctx.fillRect(h.x + Math.cos(a) * d - sz / 2, h.y + Math.sin(a) * d - sz / 2 + h.t * h.t * 900, sz, sz);
    }
  }

  guard(ctx, h, f, u) {
    // Hexagonal shield flash on the defender's front.
    const r = [36, 52, 58, 50, 0][Math.min(4, f)];
    if (!r) return;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.3) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 1.3); }
    ctx.closePath();
    ctx.fillStyle = f === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(120,200,255,0.45)';
    ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#bfeaff'; ctx.stroke();
    ctx.restore();
  }

  parry(ctx, h, f, u) {
    const col = h.kind === 'parry' ? '#7fffd0' : '#ffffff';
    for (let k = 0; k < 2; k++) {
      const rr = 30 + f * 30 - k * 24;
      if (rr <= 0) continue;
      ctx.strokeStyle = k ? '#ffffff' : col; ctx.lineWidth = 8 - f;
      ctx.beginPath(); ctx.arc(h.x, h.y, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + h.rot;
      const d0 = 20 + f * 22;
      ctx.save(); ctx.translate(h.x + Math.cos(a) * d0, h.y + Math.sin(a) * d0); ctx.rotate(a);
      ctx.fillRect(0, -3, 34 - f * 3, 6);
      ctx.restore();
    }
  }
}
