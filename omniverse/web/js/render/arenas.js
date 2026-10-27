// Arena backdrops: pre-painted parallax layers plus animated details drawn each frame.
import { glowSprite, rgba, shade } from './colors.js';
import { UNIT, ditherCanvas } from './pixel.js';

function layer(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  return c;
}

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// Layers are painted in "layer space": x in [-2400, 2400], y in [-1800, 400] (ground at 0), one
// canvas pixel per art pixel, then dithered so gradients become pixel-art bands.
const LW = 4800, LH = 2200, LS = 1 / UNIT, LY0 = -1800;
function paintLayer(paint) {
  return ditherCanvas(layer(Math.ceil(LW * LS), Math.ceil(LH * LS), (g) => {
    g.scale(LS, LS);
    g.translate(LW / 2, -LY0);
    paint(g);
  }), 22);
}

// ---------- Valley of the End ----------
function statue(g, x, flip, hairLong) {
  g.save();
  g.translate(x, 60);
  g.scale(flip * 0.68, 0.68);
  const stone = g.createLinearGradient(-200, -1500, 200, 0);
  stone.addColorStop(0, '#b9b2a4'); stone.addColorStop(0.5, '#8d8576'); stone.addColorStop(1, '#5d564b');
  g.fillStyle = stone; g.strokeStyle = '#3d382f'; g.lineWidth = 6;
  // Cliff pedestal
  g.beginPath(); g.moveTo(-330, 300); g.lineTo(-260, -380); g.lineTo(-160, -460); g.lineTo(200, -470); g.lineTo(300, -380); g.lineTo(360, 300); g.closePath(); g.fill(); g.stroke();
  // Robe/body
  g.beginPath(); g.moveTo(-170, -460); g.lineTo(-150, -1000); g.quadraticCurveTo(-120, -1180, 0, -1200); g.quadraticCurveTo(120, -1180, 150, -1000); g.lineTo(180, -460); g.closePath(); g.fill(); g.stroke();
  // Armor plates
  g.strokeStyle = '#4d473d'; g.lineWidth = 4;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-150, -1000 + i * 120); g.lineTo(150, -1000 + i * 120); g.stroke(); }
  // Arm raised in a hand seal
  g.fillStyle = stone; g.strokeStyle = '#3d382f'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(90, -1080); g.quadraticCurveTo(230, -1000, 200, -880); g.lineTo(170, -1140); g.lineTo(200, -1230); g.lineTo(150, -1240); g.lineTo(130, -1150); g.closePath(); g.fill(); g.stroke();
  // Head
  g.beginPath(); g.ellipse(0, -1290, 85, 100, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // Hair
  g.fillStyle = shade('#8d8576', -0.1);
  g.beginPath(); g.moveTo(-90, -1330);
  if (hairLong) { g.lineTo(-170, -900); g.lineTo(-120, -950); g.lineTo(-150, -800); g.lineTo(-80, -1000); }
  else { g.lineTo(-150, -1050); g.lineTo(-90, -1100); }
  g.quadraticCurveTo(-60, -1400, 40, -1395); g.quadraticCurveTo(110, -1380, 90, -1300); g.quadraticCurveTo(10, -1360, -90, -1330); g.fill(); g.stroke();
  g.restore();
}

function buildValley() {
  const sky = paintLayer(g => {
    const grad = g.createLinearGradient(0, -1800, 0, 300);
    grad.addColorStop(0, '#1f2f63'); grad.addColorStop(0.45, '#5d6fae'); grad.addColorStop(0.75, '#f0a36a'); grad.addColorStop(1, '#ffd79a');
    g.fillStyle = grad; g.fillRect(-2400, -1800, 4800, 2200);
    g.drawImage(glowSprite('#fff1c8', 256), -500, -600, 1000, 1000);
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rgba('#ffffff', 0.12 + r() * 0.12);
      const x = -2400 + r() * 4800, y = -1600 + r() * 900, w = 200 + r() * 500;
      g.beginPath(); g.ellipse(x, y, w, 30 + r() * 40, 0, 0, Math.PI * 2); g.fill();
    }
  });
  const far = paintLayer(g => {
    const r = rng(9);
    for (const [col, base, amp] of [['#6f7fa8', -350, 500], ['#53628d', -150, 380]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(-2400, 400);
      for (let x = -2400; x <= 2400; x += 80) g.lineTo(x, base - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.0021 + r()))) + r() * 60);
      g.lineTo(2400, 400); g.closePath(); g.fill();
    }
    // Forest band
    g.fillStyle = '#2f4a3a';
    for (let x = -2400; x < 2400; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, -120 - r() * 80); g.lineTo(x + 40, 0); g.fill(); }
  });
  const mid = paintLayer(g => {
    // Gorge walls
    const wall = g.createLinearGradient(0, -1200, 0, 300);
    wall.addColorStop(0, '#6d6656'); wall.addColorStop(1, '#3a352c');
    g.fillStyle = wall;
    g.beginPath(); g.moveTo(-2400, 300); g.lineTo(-2400, -1100); g.lineTo(-1700, -900); g.lineTo(-1400, -520); g.lineTo(-1250, 300); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(2400, 300); g.lineTo(2400, -1100); g.lineTo(1700, -900); g.lineTo(1400, -520); g.lineTo(1250, 300); g.closePath(); g.fill();
    statue(g, -1000, 1, false);
    statue(g, 1000, -1, true);
    // Waterfall cliff in the middle
    g.fillStyle = '#4e483c';
    g.fillRect(-800, -700, 1600, 1000);
    g.fillStyle = '#5d5747'; g.fillRect(-800, -720, 1600, 40);
  });
  return {
    layers: [{ img: sky, p: 0.02 }, { img: far, p: 0.12 }, { img: mid, p: 0.45 }],
    animate(g, t) {
      // Waterfall: bright streaks scrolling down between the statues (in mid-layer space).
      g.save();
      const grad = g.createLinearGradient(0, -700, 0, 0);
      grad.addColorStop(0, '#cfe8ff'); grad.addColorStop(1, '#8fc0e8');
      g.fillStyle = grad; g.globalAlpha = 0.92;
      g.fillRect(-760, -690, 1520, 700);
      g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
      for (let i = 0; i < 46; i++) {
        const x = -760 + (i * 33.3) % 1520, y = ((t * 900 + i * 137) % 760) - 700;
        g.fillRect(x, y, 6, 70);
      }
      g.globalAlpha = 0.45;
      for (let i = 0; i < 10; i++) g.drawImage(glowSprite('#ffffff', 128), -800 + i * 170 + Math.sin(t + i) * 30, -120, 260, 220);
      // Spray drifting up off the plunge pool.
      g.globalAlpha = 0.7; g.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) { const k = (t * 0.6 + i * 0.137) % 1; g.fillRect(-760 + ((i * 211) % 1520) + Math.sin(t * 2 + i) * 20, -20 - k * 260, 8, 8); }
      g.restore();
      // A flock of birds crossing the gorge, wings flapping.
      const bk = (t * 0.03) % 1;
      if (bk < 0.6) {
        g.fillStyle = '#2a2a3a';
        for (let i = 0; i < 7; i++) {
          const bx = -2300 + bk / 0.6 * 4600 - (i % 3) * 70 - i * 30, by = -1150 + Math.floor(i / 2) * 40 + Math.sin(t * 3 + i) * 10;
          const up = Math.sin(t * 14 + i) > 0 ? -1 : 1;
          g.fillRect(bx - 18, by + up * 8, 14, 5); g.fillRect(bx - 6, by, 12, 6); g.fillRect(bx + 4, by + up * 8, 14, 5);
        }
      }
      // Leaves blowing across from the forest.
      for (let i = 0; i < 18; i++) {
        const lx = -2400 + ((t * (80 + i * 7) + i * 431) % 4800), ly = -900 + ((i * 173 + t * 40) % 900) + Math.sin(t * 2 + i) * 30;
        g.fillStyle = i % 3 ? '#4f7a3a' : '#c8903a';
        g.save(); g.translate(lx, ly); g.rotate(t * 3 + i); g.fillRect(-8, -4, 16, 8); g.restore();
      }
      // The statues' eyes catch the light now and then.
      const eye = Math.max(0, Math.sin(t * 0.5)) ** 8;
      if (eye > 0.02) for (const x of [-1000, 1000]) { g.globalAlpha = eye; g.drawImage(glowSprite('#fff1c8', 64), x - 40, 60 - 1290 * 0.68 - 40, 80, 60); g.globalAlpha = 1; }
    },
    floor(g, left, right) {
      // River surface the fighters stand on.
      const grad = g.createLinearGradient(0, 0, 0, 500);
      grad.addColorStop(0, '#5aa0d8'); grad.addColorStop(0.2, '#2f6aa0'); grad.addColorStop(1, '#173a5e');
      g.fillStyle = grad; g.fillRect(left - 2000, 0, right - left + 4000, 700);
      g.fillStyle = '#cfe8ff'; g.fillRect(left - 2000, 0, right - left + 4000, 5);
    },
    floorAnim(g, left, right, t) {
      // Ripples: short pixel dashes drifting downstream.
      g.fillStyle = rgba('#e8f4ff', 0.7);
      for (let i = 0; i < 30; i++) {
        const x = left - 400 + ((i * 197 + t * 60) % (right - left + 800)), y = 20 + (i * 53) % 260;
        g.fillRect(Math.round(x / UNIT) * UNIT, Math.round(y / UNIT) * UNIT, UNIT * (6 + i % 5), UNIT);
      }
    },
    platform(g, p) { rockLedge(g, p, '#7a7262', '#4d473c'); },
  };
}

function rockLedge(g, p, top, side) {
  const w = p.x2 - p.x1;
  g.fillStyle = side; g.strokeStyle = '#2a261f'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(p.x1 - 10, p.y); g.lineTo(p.x2 + 10, p.y); g.lineTo(p.x2 - 30, p.y + 60); g.lineTo(p.x1 + w * 0.5, p.y + 110); g.lineTo(p.x1 + 30, p.y + 60); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = top; g.fillRect(p.x1 - 10, p.y - 6, w + 20, 16); g.strokeRect(p.x1 - 10, p.y - 6, w + 20, 16);
}

// ---------- Avengers Tower rooftop ----------
function skyline(g, base, col, lit, seed, minH, maxH) {
  const r = rng(seed);
  let x = -2400;
  while (x < 2400) {
    const w = 80 + r() * 160, h = minH + r() * (maxH - minH);
    g.fillStyle = col; g.fillRect(x, base - h, w, h + 400);
    if (lit) {
      for (let wy = base - h + 16; wy < base - 10; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) {
        if (r() < lit) { g.fillStyle = r() < 0.7 ? '#ffd98a' : '#bfe0ff'; g.fillRect(wx, wy, 10, 12); }
      }
    }
    if (r() < 0.2) { g.fillStyle = col; g.fillRect(x + w / 2 - 4, base - h - 80, 8, 80); }
    x += w + r() * 20;
  }
}

function buildTower() {
  const sky = paintLayer(g => {
    const grad = g.createLinearGradient(0, -1800, 0, 300);
    grad.addColorStop(0, '#0d1030'); grad.addColorStop(0.5, '#3a2a6a'); grad.addColorStop(0.8, '#c8506a'); grad.addColorStop(1, '#ff9a5a');
    g.fillStyle = grad; g.fillRect(-2400, -1800, 4800, 2200);
    const r = rng(5);
    for (let i = 0; i < 200; i++) { g.fillStyle = rgba('#ffffff', r() * 0.8); g.fillRect(-2400 + r() * 4800, -1800 + r() * 1000, 3, 3); }
    g.drawImage(glowSprite('#ffb07a', 256), -1600, -500, 1200, 900);
  });
  const far = paintLayer(g => skyline(g, 100, '#22203f', 0.18, 11, 300, 800));
  const mid = paintLayer(g => {
    skyline(g, 300, '#15142a', 0.32, 23, 500, 1100);
    // The tower: tall, tapering, with a lit crown and a landing platform.
    g.fillStyle = '#1d2236';
    g.beginPath(); g.moveTo(-260, 400); g.lineTo(-180, -1250); g.lineTo(-60, -1450); g.lineTo(80, -1420); g.lineTo(180, -1250); g.lineTo(260, 400); g.closePath(); g.fill();
    g.fillStyle = '#2a3150'; g.fillRect(-180, -1100, 360, 18); g.fillRect(-150, -1300, 300, 14);
    g.fillStyle = '#9ad8ff';
    for (let y = -1200; y < 300; y += 40) g.fillRect(-150, y, 300, 4);
    // Glass mullions and the glowing "A" crest on the tower face.
    g.fillStyle = '#141a2c';
    for (let x = -150; x <= 150; x += 50) g.fillRect(x - 3, -1200, 6, 1500);
    g.strokeStyle = '#ffffff'; g.lineWidth = 22; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(-70, -1000); g.lineTo(0, -1180); g.lineTo(70, -1000); g.moveTo(-40, -1070); g.lineTo(40, -1070); g.stroke();
    g.strokeStyle = '#7fd0ff'; g.lineWidth = 8;
    g.beginPath(); g.arc(0, -1080, 115, 0, Math.PI * 2); g.stroke();
    g.drawImage(glowSprite('#7fd0ff', 256), -160, -1460, 320, 220);
    g.strokeStyle = '#7fd0ff'; g.lineWidth = 10;
    g.beginPath(); g.arc(0, -1320, 60, 0, Math.PI * 2); g.stroke();
  });
  return {
    layers: [{ img: sky, p: 0.02 }, { img: far, p: 0.12 }, { img: mid, p: 0.3 }],
    animate(g, t) {
      // Windows switching on and off across the city.
      g.fillStyle = '#ffd98a';
      for (let i = 0; i < 14; i++) {
        if (Math.sin(t * 0.7 + i * 12.9) < 0.3) continue;
        g.fillRect(-2200 + ((i * 677) % 4400), -900 + ((i * 391) % 900), 10, 12);
      }
      // Searchlights
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, ph] of [[-900, 0], [900, 2]]) {
        const a = -Math.PI / 2 + Math.sin(t * 0.4 + ph) * 0.5;
        g.save(); g.translate(x, 300); g.rotate(a + Math.PI / 2);
        const grad = g.createLinearGradient(0, 0, 0, -1800);
        grad.addColorStop(0, rgba('#fff1c8', 0.22)); grad.addColorStop(1, rgba('#fff1c8', 0));
        g.fillStyle = grad; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-180, -1800); g.lineTo(180, -1800); g.lineTo(20, 0); g.fill();
        g.restore();
      }
      // Red aircraft warning lights blinking on the rooftops.
      for (let i = 0; i < 9; i++) if (Math.sin(t * 3 + i * 1.7) > 0.4) { g.fillStyle = '#ff3a3a'; const x = -2100 + i * 520, y = -700 - (i * 271) % 500; g.fillRect(x, y, 10, 10); g.drawImage(glowSprite('#ff3a3a', 32), x - 25, y - 25, 60, 60); }
      // A helicopter hovering with its spotlight swinging over the city.
      const hx = Math.sin(t * 0.13) * 1700, hy = -1350 + Math.sin(t * 0.7) * 30;
      g.fillStyle = '#0b0d18';
      g.fillRect(hx - 50, hy - 18, 100, 36); g.fillRect(hx + 40, hy - 8, 90, 10); g.fillRect(hx + 120, hy - 26, 10, 26);
      g.fillRect(hx - 90 + Math.sin(t * 60) * 20, hy - 26, 180 - Math.sin(t * 60) * 40, 5);
      g.fillStyle = '#ff3a3a'; if (Math.sin(t * 8) > 0) g.fillRect(hx + 122, hy - 30, 6, 6);
      const ha = Math.sin(t * 0.9) * 0.4;
      g.save(); g.translate(hx - 20, hy + 18); g.rotate(ha);
      const hg = g.createLinearGradient(0, 0, 0, 900); hg.addColorStop(0, rgba('#fff8e0', 0.3)); hg.addColorStop(1, rgba('#fff8e0', 0));
      g.fillStyle = hg; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-130, 900); g.lineTo(130, 900); g.lineTo(8, 0); g.fill();
      g.restore();
      // A jet crossing the sky now and then.
      const k = (t * 0.05) % 1;
      if (k < 0.5) {
        const x = -2200 + k * 2 * 4400, y = -1100 + Math.sin(k * 6) * 40;
        g.fillStyle = '#0b0d18'; g.beginPath(); g.moveTo(x + 60, y); g.lineTo(x - 50, y - 12); g.lineTo(x - 70, y - 36); g.lineTo(x - 40, y - 8); g.lineTo(x - 60, y + 6); g.closePath(); g.fill();
        g.drawImage(glowSprite('#7fd0ff', 64), x - 120, y - 20, 70, 30);
        g.fillStyle = Math.sin(t * 10) > 0 ? '#ff4a4a' : '#ffffff'; g.fillRect(x - 64, y - 36, 5, 5);
      }
      g.restore();
    },
    floor(g, left, right) {
      // Rooftop deck with helipad.
      g.fillStyle = '#3a3f52'; g.fillRect(left - 2000, 0, right - left + 4000, 700);
      g.fillStyle = '#4d5368'; g.fillRect(left - 40, 0, right - left + 80, 26);
      g.strokeStyle = rgba('#000000', 0.25); g.lineWidth = 2;
      for (let x = left; x < right; x += 160) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x, 700); g.stroke(); }
      g.strokeStyle = '#f2c14e'; g.lineWidth = 6;
      g.beginPath(); g.ellipse(0, 70, 420, 50, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#f2c14e'; g.font = 'bold 70px Arial'; g.textAlign = 'center'; g.fillText('H', 0, 95);
      // Railings at the edges.
      g.strokeStyle = '#9aa4bd'; g.lineWidth = 6;
      for (const x of [left - 10, right + 10]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -110); g.stroke(); }
      g.fillStyle = rgba('#ffffff', 0.15); g.fillRect(left - 40, 0, right - left + 80, 3);
    },
    platform(g, p) {
      const w = p.x2 - p.x1;
      g.fillStyle = '#5a6278'; g.strokeStyle = '#1a1d2a'; g.lineWidth = 3;
      g.fillRect(p.x1, p.y - 8, w, 18); g.strokeRect(p.x1, p.y - 8, w, 18);
      g.strokeStyle = '#7a849c'; g.lineWidth = 4;
      for (let x = p.x1 + 20; x < p.x2; x += 50) { g.beginPath(); g.moveTo(x, p.y + 10); g.lineTo(x + 25, p.y + 70); g.stroke(); }
      g.fillStyle = '#ff4a4a'; g.fillRect(p.x1 + 4, p.y - 14, 8, 6); g.fillRect(p.x2 - 12, p.y - 14, 8, 6);
    },
  };
}

// ---------- Otsutsuki dimension ----------
function buildKara() {
  const sky = paintLayer(g => {
    const grad = g.createLinearGradient(0, -1800, 0, 300);
    grad.addColorStop(0, '#1a0a2e'); grad.addColorStop(0.5, '#5a1f6a'); grad.addColorStop(0.85, '#d86a8a'); grad.addColorStop(1, '#ffc0a0');
    g.fillStyle = grad; g.fillRect(-2400, -1800, 4800, 2200);
    // Giant moon
    const mg = g.createRadialGradient(700, -760, 50, 700, -760, 420);
    mg.addColorStop(0, '#fff0f0'); mg.addColorStop(0.7, '#e8c0d8'); mg.addColorStop(1, rgba('#e8c0d8', 0));
    g.fillStyle = mg; g.beginPath(); g.arc(700, -760, 420, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba('#a87aa8', 0.35);
    for (const [x, y, r] of [[600, -840, 60], [820, -680, 40], [700, -640, 25]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    const r = rng(17);
    for (let i = 0; i < 160; i++) { g.fillStyle = rgba('#ffffff', r() * 0.7); g.fillRect(-2400 + r() * 4800, -1800 + r() * 900, 3, 3); }
  });
  const far = paintLayer(g => {
    // God Tree silhouette
    g.fillStyle = '#3a1f4a';
    g.beginPath(); g.moveTo(-1300, 300); g.quadraticCurveTo(-1250, -400, -1350, -900); g.lineTo(-1250, -900); g.quadraticCurveTo(-1150, -400, -1050, 300); g.fill();
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(-1300 + Math.cos(i) * 260, -1000 + Math.sin(i * 1.7) * 160, 220, 120, i, 0, Math.PI * 2); g.fill(); }
    // Dunes
    g.fillStyle = '#7a3f6a';
    g.beginPath(); g.moveTo(-2400, 400);
    for (let x = -2400; x <= 2400; x += 100) g.lineTo(x, -80 - Math.sin(x * 0.0018) * 120 - Math.sin(x * 0.005) * 40);
    g.lineTo(2400, 400); g.fill();
  });
  const mid = paintLayer(g => {
    // Crystal spires
    const r = rng(31);
    for (let i = 0; i < 14; i++) {
      const x = -2300 + i * 350 + r() * 120, h = 300 + r() * 700, w = 50 + r() * 70;
      const grad = g.createLinearGradient(x - w, 0, x + w, 0);
      grad.addColorStop(0, '#c89ae8'); grad.addColorStop(0.5, '#f0d8ff'); grad.addColorStop(1, '#8a5aa8');
      g.fillStyle = grad; g.strokeStyle = '#4a2a5a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x - w, 300); g.lineTo(x - w * 0.6, -h); g.lineTo(x, -h - 120); g.lineTo(x + w * 0.6, -h); g.lineTo(x + w, 300); g.closePath(); g.fill(); g.stroke();
    }
  });
  const rocks = [[-1500, -560, 120], [-650, -760, 80], [1350, -620, 110], [250, -880, 70], [1900, -420, 90]];
  return {
    layers: [{ img: sky, p: 0.02 }, { img: far, p: 0.12 }, { img: mid, p: 0.4 }],
    animate(g, t) {
      // Chakra motes drifting up through the dimension.
      for (let i = 0; i < 40; i++) {
        const x = -2300 + ((i * 523) % 4600), y = 300 - ((t * (40 + i % 5 * 15) + i * 137) % 1700);
        g.fillStyle = i % 3 ? 'rgba(232,192,255,0.8)' : 'rgba(255,240,200,0.9)';
        g.fillRect(x + Math.sin(t + i) * 20, y, 8, 8);
      }
      // Shooting stars across the void.
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.18 + i * 0.5) % 1;
        if (k < 0.18) {
          const u = k / 0.18, sx = -2000 + i * 1800 + u * 1400, sy = -1500 + u * 500;
          const sg = g.createLinearGradient(sx, sy, sx - 300, sy - 107);
          sg.addColorStop(0, 'rgba(255,240,255,0.9)'); sg.addColorStop(1, 'rgba(255,240,255,0)');
          g.strokeStyle = sg; g.lineWidth = 6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 300, sy - 107); g.stroke();
        }
      }
      // The chakra fruit on the God Tree pulsing with stolen power.
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.6);
      g.globalAlpha = pulse; g.drawImage(glowSprite('#ff5a8a', 64), -1430, -1190, 260, 260); g.globalAlpha = 1;
      g.fillStyle = '#ff7aa8'; g.beginPath(); g.arc(-1300, -1060, 30 + pulse * 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe0ec'; g.fillRect(-1310, -1076, 10, 10);
      for (const [x, y, s] of rocks) {
        const yy = y + Math.sin(t * 0.8 + x) * 20;
        g.fillStyle = '#4a2f5a'; g.strokeStyle = '#2a1a33'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - s, yy); g.lineTo(x + s, yy - 10); g.lineTo(x + s * 0.4, yy + s * 0.8); g.lineTo(x - s * 0.5, yy + s * 0.6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c89ae8'; g.fillRect(x - s * 0.8, yy - 12, s * 1.6, 12);
      }
    },
    floor(g, left, right) {
      const grad = g.createLinearGradient(0, 0, 0, 500);
      grad.addColorStop(0, '#e8c0b0'); grad.addColorStop(0.15, '#b07a8a'); grad.addColorStop(1, '#5a3050');
      g.fillStyle = grad; g.fillRect(left - 2000, 0, right - left + 4000, 700);
      // Ancient floor carvings
      g.strokeStyle = rgba('#5a2a50', 0.5); g.lineWidth = 4;
      for (let x = left; x < right; x += 220) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 110, 8); g.lineTo(x + 110, 40); g.stroke(); }
    },
    floorAnim(g, left, right, t) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.3 + Math.sin(t * 2) * 0.1;
      g.drawImage(glowSprite('#c9a6ff', 128), -300, -60, 600, 140);
      g.restore();
    },
    platform(g, p) { rockLedge(g, p, '#d8b0c8', '#5a3a6a'); },
  };
}

const BUILDERS = { valley: buildValley, tower: buildTower, kara: buildKara };
const cache = new Map();

export function arenaArt(theme) {
  if (!cache.has(theme)) cache.set(theme, BUILDERS[theme]());
  return cache.get(theme);
}

// Static floor and platforms pre-painted and dithered once per arena.
export function buildStage(art, arena) {
  const x0 = arena.left - 1300, x1 = arena.right + 1300, y0 = arena.ceiling, y1 = 800;
  const c = layer(Math.ceil((x1 - x0) / UNIT), Math.ceil((y1 - y0) / UNIT), g => {
    g.scale(1 / UNIT, 1 / UNIT);
    g.translate(-x0, -y0);
    g.lineJoin = 'round';
    art.floor(g, arena.left, arena.right);
    for (const p of arena.platforms) if (p.thin) art.platform(g, p);
  });
  return { img: ditherCanvas(c, 24), x0, y0 };
}

// Where the Otsutsuki moon sits on screen (art pixels), for the eclipse.
export function moonAt(theme, cam, W, H) {
  if (theme !== 'kara') return null;
  return { x: W / 2 + (700 - cam.x * 0.02) / UNIT, y: H / 2 + (-760 - cam.y * 0.02) / UNIT, r: 300 / UNIT };
}

// Draw the backdrop in art pixels for a camera at (cam.x, cam.y), screen W x H art pixels.
export function drawBackdrop(ctx, art, cam, W, H, t) {
  art.layers.forEach((L, i) => {
    const ox = Math.round(W / 2 + (-LW / 2 - cam.x * L.p) / UNIT);
    const oy = Math.round(H / 2 + (LY0 - cam.y * L.p) / UNIT);
    ctx.drawImage(L.img, ox, oy);
    if (i === 2) {
      ctx.save();
      ctx.translate(ox + LW / 2 / UNIT, oy - LY0 / UNIT);
      ctx.scale(1 / UNIT, 1 / UNIT);
      art.animate(ctx, t);
      ctx.restore();
    }
  });
}
