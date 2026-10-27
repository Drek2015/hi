// Energy gathering in a fighter's hand while an ability winds up (drawn at full resolution).
import { fxInfo } from './fx.js';
import { glowSprite } from './colors.js';

function bolt(g, x, y, len, ang, width, color) {
  g.strokeStyle = color; g.lineWidth = width;
  g.beginPath(); g.moveTo(x, y);
  let px = x, py = y;
  const n = 5;
  for (let i = 1; i <= n; i++) {
    const d = len * i / n, j = (Math.random() - 0.5) * len * 0.35;
    px = x + Math.cos(ang) * d - Math.sin(ang) * j; py = y + Math.sin(ang) * d + Math.cos(ang) * j;
    g.lineTo(px, py);
  }
  g.stroke();
}

// x, y: hand position in the sprite's local space; bh: body height in screen pixels.
export function drawCharge(g, x, y, bh, c, t) {
  const info = fxInfo(c.fx);
  const col = c.color || info.color || '#ffffff', col2 = info.color2 || '#ffffff';
  const k = c.held ? 1 : c.k;
  const r = bh * (0.06 + 0.1 * k);
  const frame = Math.floor(t * 30);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.85;
  g.drawImage(glowSprite(col, 64), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  switch (info.style) {
    case 'spiral': {
      g.drawImage(glowSprite(col2, 64), x - r, y - r, r * 2, r * 2);
      g.strokeStyle = col2; g.lineWidth = Math.max(2, r * 0.12);
      for (let i = 0; i < 4; i++) {
        const a0 = t * 18 + i * Math.PI / 2;
        g.beginPath(); g.ellipse(x, y, r, r * 0.45, a0 * 0.3 + i, a0, a0 + 2.2); g.stroke();
      }
      break;
    }
    case 'bolt': case 'beamBolt': {
      g.drawImage(glowSprite('#ffffff', 64), x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      const seed = frame;
      for (let i = 0; i < 6; i++) bolt(g, x, y, r * (1.4 + ((seed * 7 + i * 3) % 5) * 0.25), ((seed * 13 + i * 61) % 360) * Math.PI / 180, Math.max(2, r * 0.09), i % 2 ? col2 : col);
      break;
    }
    case 'fire': case 'beamFire': {
      for (let i = 0; i < 5; i++) {
        const a = t * 6 + i * 1.3;
        g.drawImage(glowSprite(i % 2 ? col : col2, 64), x + Math.cos(a) * r * 0.5 - r * 0.6, y - r * 0.5 - (t * 3 + i * 0.2) % 1 * r - r * 0.6, r * 1.2, r * 1.2);
      }
      break;
    }
    default: {
      // Charging orb: rings collapse inward toward the hand.
      g.drawImage(glowSprite(col2, 64), x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      g.strokeStyle = col; g.lineWidth = Math.max(2, r * 0.1);
      for (let i = 0; i < 2; i++) {
        const u = ((t * 2.5 + i * 0.5) % 1);
        g.globalAlpha = 0.8 * u;
        g.beginPath(); g.arc(x, y, r * (2.6 - u * 2), 0, Math.PI * 2); g.stroke();
      }
    }
  }
  g.restore();
}
