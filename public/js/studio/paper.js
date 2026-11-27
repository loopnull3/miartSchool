// 배경지(종이) — 모두 절차적으로 생성하는 타일 텍스처
// 타일 한 변(TILE)은 노이즈 셀 크기와 캔버스 실 간격으로 나누어떨어져야 이음매가 생기지 않는다.
export const TILE = 480;

export const PAPERS = {
  white: { label: '흰 도화지', base: '#ffffff', rgb: [255, 255, 255] },
  ivory: { label: '미색 도화지', base: '#f7f0de', rgb: [247, 240, 222] },
  kraft: { label: '크라프트지', base: '#c79f74', rgb: [199, 159, 116] },
  black: { label: '검정 도화지', base: '#222224', rgb: [34, 34, 36], dark: true },
  watercolor: { label: '수채화지', base: '#fcfbf6', rgb: [252, 251, 246] },
  canvas: { label: '캔버스', base: '#f1ebdf', rgb: [241, 235, 223] },
};
export const PAPER_ORDER = ['white', 'ivory', 'kraft', 'black', 'watercolor', 'canvas'];

export function isPaper(kind) {
  return Object.prototype.hasOwnProperty.call(PAPERS, kind);
}

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 이어지는(타일링되는) 값 노이즈 — size % cell === 0 이어야 한다
export function tileNoise(size, cell, rnd) {
  const g = size / cell;
  const grid = new Float32Array(g * g);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy) % g;
    const y1 = (y0 + 1) % g;
    let fy = gy - Math.floor(gy);
    fy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx) % g;
      const x1 = (x0 + 1) % g;
      let fx = gx - Math.floor(gx);
      fx = fx * fx * (3 - 2 * fx);
      const a = grid[y0 * g + x0] + (grid[y0 * g + x1] - grid[y0 * g + x0]) * fx;
      const b = grid[y1 * g + x0] + (grid[y1 * g + x1] - grid[y1 * g + x0]) * fx;
      out[y * size + x] = a + (b - a) * fy;
    }
  }
  return out;
}

const memo = new Map();
function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
}

// 수채화지(콜드프레스) 높이 맵 0..1
export function watercolorHeight() {
  return once('h:watercolor', () => {
    const rnd = mulberry32(4242);
    const a = tileNoise(TILE, 40, rnd);
    const b = tileNoise(TILE, 16, rnd);
    const c = tileNoise(TILE, 8, rnd);
    const d = tileNoise(TILE, 4, rnd);
    const out = new Float32Array(TILE * TILE);
    let min = 1e9;
    let max = -1e9;
    for (let i = 0; i < out.length; i++) {
      // 둥근 언덕 모양이 되도록 중간 주파수를 강조
      const v = a[i] * 0.25 + b[i] * 0.42 + c[i] * 0.22 + d[i] * 0.11;
      out[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const k = 1 / (max - min || 1);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) * k;
    return out;
  });
}

// 캔버스 평직 — 실이 위로 올라온 정도 0..1 (0 = 실 사이 틈)
export const WEAVE_CELL = 6;
export function canvasWeave() {
  return once('h:canvas', () => {
    const c = WEAVE_CELL;
    const n = TILE / c;
    const rnd = mulberry32(777);
    const colVar = Array.from({ length: n }, () => 0.85 + rnd() * 0.3);
    const rowVar = Array.from({ length: n }, () => 0.85 + rnd() * 0.3);
    const slub = tileNoise(TILE, 24, rnd);
    const out = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      const cy = (y / c) | 0;
      const fy = ((y % c) + 0.5) / c;
      for (let x = 0; x < TILE; x++) {
        const cx = (x / c) | 0;
        const fx = ((x % c) + 0.5) / c;
        const warpTop = (cx + cy) % 2 === 0;
        let p;
        if (warpTop) p = Math.sin(Math.PI * fx) * (0.82 + 0.18 * Math.sin(Math.PI * fy)) * colVar[cx];
        else p = Math.sin(Math.PI * fy) * (0.82 + 0.18 * Math.sin(Math.PI * fx)) * rowVar[cy];
        p *= 0.9 + slub[y * TILE + x] * 0.2;
        out[y * TILE + x] = Math.min(1, Math.max(0, p));
      }
    }
    return out;
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// 종이 섬유: 타일 경계를 넘으면 반대편에도 그려서 이음매를 없앤다
function fibers(ctx, rnd, count, colorFn, lenMin, lenMax, width) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * TILE;
    const y = rnd() * TILE;
    const len = lenMin + rnd() * (lenMax - lenMin);
    const ang = rnd() * Math.PI;
    const bend = (rnd() - 0.5) * len * 0.5;
    ctx.strokeStyle = colorFn(rnd);
    ctx.lineWidth = width * (0.6 + rnd() * 0.8);
    for (const ox of [-TILE, 0, TILE]) {
      for (const oy of [-TILE, 0, TILE]) {
        const sx = x + ox;
        const sy = y + oy;
        if (sx < -len || sx > TILE + len || sy < -len || sy > TILE + len) continue;
        const ex = sx + Math.cos(ang) * len;
        const ey = sy + Math.sin(ang) * len;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) / 2 + Math.sin(ang) * bend, (sy + ey) / 2 - Math.cos(ang) * bend, ex, ey);
        ctx.stroke();
      }
    }
  }
}

export function paperTile(kind) {
  if (kind === 'white' || !isPaper(kind)) return null;
  return once(`tile:${kind}`, () => {
    const c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(TILE, TILE);
    const d = img.data;
    const [br, bg, bb] = PAPERS[kind].rgb;
    const rnd = mulberry32(kind.length * 131 + 9);
    const mottle = tileNoise(TILE, 60, rnd);
    const mid = tileNoise(TILE, 12, rnd);
    if (kind === 'watercolor') {
      const hm = watercolorHeight();
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const i = y * TILE + x;
          const xm = (x + TILE - 1) % TILE;
          const ym = (y + TILE - 1) % TILE;
          const xp = (x + 1) % TILE;
          const yp = (y + 1) % TILE;
          // 왼쪽 위에서 비추는 빛으로 엠보스
          const slope = hm[ym * TILE + xm] - hm[yp * TILE + xp];
          const shade = slope * 34 + (hm[i] - 0.5) * 7 + (mottle[i] - 0.5) * 3 + (rnd() - 0.5) * 2;
          d[i * 4] = br + shade;
          d[i * 4 + 1] = bg + shade;
          d[i * 4 + 2] = bb + shade * 1.05;
          d[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
    if (kind === 'canvas') {
      const wv = canvasWeave();
      for (let i = 0; i < TILE * TILE; i++) {
        const p = wv[i];
        const f = 0.8 + 0.22 * p;
        const n = (mottle[i] - 0.5) * 6 + (rnd() - 0.5) * 4;
        d[i * 4] = br * f + n;
        d[i * 4 + 1] = bg * f + n;
        d[i * 4 + 2] = bb * f + n - 2 * (1 - p);
        d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
    const amp = { ivory: [3, 2.2], kraft: [9, 6], black: [3, 3.2] }[kind];
    for (let i = 0; i < TILE * TILE; i++) {
      const n = (mottle[i] - 0.5) * amp[0] * 2 + (mid[i] - 0.5) * amp[0] + (rnd() - 0.5) * amp[1] * 2;
      d[i * 4] = br + n;
      d[i * 4 + 1] = bg + n * 0.95;
      d[i * 4 + 2] = bb + n * 0.9;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round';
    if (kind === 'kraft') {
      fibers(ctx, rnd, 900, (r) => (r() < 0.55 ? `rgba(120,82,45,${0.1 + r() * 0.14})` : `rgba(236,206,168,${0.12 + r() * 0.16})`), 4, 18, 0.9);
      fibers(ctx, rnd, 60, (r) => `rgba(90,60,30,${0.18 + r() * 0.15})`, 2, 5, 1.4);
    } else if (kind === 'ivory') {
      fibers(ctx, rnd, 260, (r) => `rgba(190,170,130,${0.05 + r() * 0.06})`, 5, 16, 0.8);
    } else if (kind === 'black') {
      fibers(ctx, rnd, 320, (r) => `rgba(255,255,255,${0.025 + r() * 0.035})`, 4, 14, 0.8);
    }
    return c;
  });
}

// ctx 전체를 종이로 채운다
export function drawPaper(ctx, W, H, kind) {
  const p = PAPERS[kind] || PAPERS.white;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, W, H);
  const tile = paperTile(kind);
  if (tile) {
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// 종이 고르기용 미리보기 (확대해서 결이 보이게)
export function paperPreview(kind, w = 120, h = 84) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const p = PAPERS[kind] || PAPERS.white;
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, w, h);
  const tile = paperTile(kind);
  if (tile) ctx.drawImage(tile, 0, 0, w, h, 0, 0, w, h);
  return c;
}
