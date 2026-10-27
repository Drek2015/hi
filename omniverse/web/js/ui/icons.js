// Pixel-art ability icons, drawn at 24x24 and scaled up with hard pixels.
import { fxInfo } from '../render/fx.js';

const N = 24;
const cache = new Map();

function glyph(g, n) {
  const fx = fxInfo(n.fx);
  const c1 = fx.color || '#ffffff', c2 = fx.color2 || '#ffffff';
  g.lineCap = 'square'; g.lineJoin = 'miter';
  const ink = '#120a1a';
  if (n.kind === 'passive') return passiveGlyph(g, n);
  switch (fx.style) {
    case 'spiral': case 'vortex':
      g.strokeStyle = c1; g.lineWidth = 3;
      g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = 1 + a * 0.85; g.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r); } g.stroke();
      g.fillStyle = c2; g.fillRect(10, 10, 4, 4); break;
    case 'orb': case 'darkOrb':
      g.fillStyle = ink; g.beginPath(); g.arc(12, 12, 9, 0, 7); g.fill();
      g.fillStyle = c1; g.beginPath(); g.arc(12, 12, 8, 0, 7); g.fill();
      g.fillStyle = c2; g.fillRect(8, 7, 4, 3); break;
    case 'bolt': case 'beamBolt':
      g.fillStyle = c1; g.beginPath(); g.moveTo(14, 2); g.lineTo(6, 13); g.lineTo(11, 13); g.lineTo(8, 22); g.lineTo(18, 9); g.lineTo(13, 9); g.lineTo(16, 2); g.closePath(); g.fill();
      g.fillStyle = c2; g.fillRect(12, 4, 2, 4); break;
    case 'fire': case 'beamFire':
      g.fillStyle = c1; g.beginPath(); g.moveTo(12, 2); g.quadraticCurveTo(21, 12, 18, 18); g.quadraticCurveTo(12, 24, 6, 18); g.quadraticCurveTo(3, 12, 12, 2); g.fill();
      g.fillStyle = c2; g.beginPath(); g.moveTo(12, 9); g.quadraticCurveTo(17, 15, 14, 19); g.quadraticCurveTo(10, 21, 9, 17); g.closePath(); g.fill(); break;
    case 'beam':
      g.fillStyle = c1; g.fillRect(2, 8, 20, 8); g.fillStyle = c2; g.fillRect(2, 10, 20, 4);
      g.fillStyle = c1; g.beginPath(); g.arc(5, 12, 6, 0, 7); g.fill(); break;
    case 'blade': case 'needle':
      g.save(); g.translate(12, 12); g.rotate(-0.8);
      g.fillStyle = c1; g.beginPath(); g.moveTo(-2, -10); g.lineTo(2, -10); g.lineTo(3, 6); g.lineTo(0, 10); g.lineTo(-3, 6); g.closePath(); g.fill();
      g.fillStyle = ink; g.fillRect(-4, 6, 8, 2); g.restore(); break;
    case 'star':
      g.save(); g.translate(12, 12);
      g.fillStyle = c1; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3 : 10; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.fillStyle = c2; g.fillRect(-2, -2, 4, 4); g.restore(); break;
    case 'slash':
      g.strokeStyle = c1; g.lineWidth = 3;
      g.beginPath(); g.arc(6, 18, 15, -1.4, -0.1); g.stroke();
      g.strokeStyle = c2; g.lineWidth = 1; g.beginPath(); g.arc(6, 18, 12, -1.3, -0.2); g.stroke(); break;
    case 'ring': case 'shinra':
      g.strokeStyle = c1; g.lineWidth = 3; g.beginPath(); g.arc(12, 12, 9, 0, 7); g.stroke();
      g.strokeStyle = c2; g.lineWidth = 2; g.beginPath(); g.arc(12, 12, 4, 0, 7); g.stroke(); break;
    case 'pillar':
      g.fillStyle = c1; g.fillRect(9, 1, 6, 22); g.fillStyle = c2; g.fillRect(11, 1, 2, 22);
      g.fillStyle = c1; g.fillRect(4, 19, 16, 3); break;
    case 'aura':
      for (const [x, h] of [[5, 12], [12, 18], [19, 12]]) { g.fillStyle = c1; g.beginPath(); g.moveTo(x - 4, 22); g.lineTo(x, 22 - h); g.lineTo(x + 4, 22); g.fill(); }
      g.fillStyle = c2; g.fillRect(10, 12, 4, 10); break;
    case 'spikes':
      g.fillStyle = c1; for (const x of [4, 12, 20]) { g.beginPath(); g.moveTo(x - 4, 22); g.lineTo(x, 4 + (x % 8)); g.lineTo(x + 4, 22); g.fill(); } break;
    case 'cube':
      g.fillStyle = c1; g.fillRect(5, 5, 14, 14); g.strokeStyle = c2; g.lineWidth = 2; g.strokeRect(6, 6, 12, 12); break;
    case 'web': case 'webTrap':
      g.strokeStyle = c1; g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(12, 12); g.lineTo(12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11); g.stroke(); }
      for (const r of [4, 8]) { g.beginPath(); g.arc(12, 12, r, 0, 7); g.stroke(); } break;
    case 'smoke':
      g.fillStyle = c1; for (const [x, y, r] of [[8, 14, 6], [15, 12, 7], [12, 8, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } break;
    case 'tendril':
      g.strokeStyle = c2; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 20); g.bezierCurveTo(8, 2, 16, 22, 20, 4); g.stroke(); break;
    default: fistGlyph(g, c1, c2);
  }
  if (n.prim === 'clones') { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(2, 2, 5, 5); g.fillRect(17, 2, 5, 5); }
  if (n.prim === 'teleport' || n.prim === 'phase') { g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.setLineDash([2, 2]); g.strokeRect(2, 2, 20, 20); g.setLineDash([]); }
}

function fistGlyph(g, c1, c2) {
  g.fillStyle = c1; g.fillRect(6, 7, 12, 11); g.fillStyle = c2;
  for (let i = 0; i < 4; i++) g.fillRect(7 + i * 3, 7, 2, 3);
  g.fillStyle = '#120a1a'; g.fillRect(6, 17, 12, 2);
  g.fillStyle = c1; g.fillRect(2, 11, 4, 2); g.fillRect(1, 15, 4, 2);
}

function passiveGlyph(g, n) {
  const m = n.mods || {};
  const key = m.boost ? 'boost' : Object.keys(m)[0];
  const gold = '#ffd84a', ink = '#120a1a';
  switch (key) {
    case 'dmg': g.fillStyle = '#e8eef8'; g.fillRect(11, 2, 3, 15); g.fillStyle = gold; g.fillRect(7, 16, 11, 2); g.fillRect(11, 18, 3, 4); break;
    case 'def': case 'armor':
      g.fillStyle = '#7fb6ff'; g.beginPath(); g.moveTo(4, 4); g.lineTo(20, 4); g.lineTo(20, 12); g.lineTo(12, 21); g.lineTo(4, 12); g.closePath(); g.fill();
      g.fillStyle = '#d8ecff'; g.fillRect(11, 6, 2, 12); break;
    case 'hp':
      g.fillStyle = '#ff4a5a'; g.beginPath(); g.moveTo(12, 21); g.lineTo(3, 11); g.arc(7.5, 8, 4.5, Math.PI, 0); g.arc(16.5, 8, 4.5, Math.PI, 0); g.lineTo(21, 11); g.closePath(); g.fill(); break;
    case 'speed': case 'airJumps':
      g.fillStyle = '#7fffd0'; for (const y of [5, 13]) { g.beginPath(); g.moveTo(4, y); g.lineTo(14, y); g.lineTo(14, y - 3); g.lineTo(21, y + 3); g.lineTo(14, y + 9); g.lineTo(14, y + 6); g.lineTo(4, y + 6); g.closePath(); g.fill(); } break;
    case 'regen': g.fillStyle = '#4fb6ff'; g.beginPath(); g.moveTo(12, 2); g.quadraticCurveTo(21, 14, 17, 19); g.quadraticCurveTo(12, 23, 7, 19); g.quadraticCurveTo(3, 14, 12, 2); g.fill(); break;
    case 'crit': g.strokeStyle = '#ff5a3a'; g.lineWidth = 2; for (const r of [9, 5]) { g.beginPath(); g.arc(12, 12, r, 0, 7); g.stroke(); } g.fillStyle = '#ff5a3a'; g.fillRect(11, 1, 2, 22); g.fillRect(1, 11, 22, 2); break;
    case 'cdr': g.fillStyle = gold; g.beginPath(); g.moveTo(5, 3); g.lineTo(19, 3); g.lineTo(12, 12); g.lineTo(19, 21); g.lineTo(5, 21); g.lineTo(12, 12); g.closePath(); g.fill(); g.fillStyle = ink; g.fillRect(4, 2, 16, 2); g.fillRect(4, 20, 16, 2); break;
    case 'lifesteal': g.fillStyle = '#c8283a'; g.beginPath(); g.moveTo(12, 3); g.quadraticCurveTo(20, 13, 16, 19); g.quadraticCurveTo(12, 22, 8, 19); g.quadraticCurveTo(4, 13, 12, 3); g.fill(); g.fillStyle = '#7fffd0'; g.fillRect(10, 12, 4, 4); break;
    case 'ultGain': g.fillStyle = '#ff4af0'; g.save(); g.translate(12, 12); g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 4 : 10; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); break;
    default: g.fillStyle = gold; g.fillRect(10, 4, 4, 16); g.fillRect(4, 10, 16, 4); g.fillStyle = '#fff6c0'; g.fillRect(11, 5, 2, 6);
  }
}

// Returns a 24x24 canvas with the node's icon.
export function abilityIcon(n) {
  const key = n.id + '|' + n.fx + '|' + n.kind;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = N;
  glyph(c.getContext('2d'), n);
  cache.set(key, c);
  return c;
}
