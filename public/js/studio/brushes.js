// 브러시 정의와 스트로크 렌더러 (스탬프 방식 + 직접 칠하는 도구)
import { mulberry32, tileNoise, TILE, watercolorHeight, canvasWeave } from './paper.js';

// dab: 붓 자국 모양 · texture: 종이 질감 마스크 · direct: 레이어에 바로 칠함(미리보기 버퍼 없이)
export const BRUSHES = {
  pencil: { label: '연필', size: 4, min: 1, max: 30, opacity: 0.92, dab: 'hard', texture: 'grain-light', spacing: 0.2, pressureSize: 0.55, smoothing: 0.35 },
  crayon: { label: '크레용', size: 18, min: 6, max: 70, opacity: 0.96, dab: 'hard', texture: 'grain-heavy', spacing: 0.12, pressureSize: 0.35, smoothing: 0.3 },
  pen: { label: '사인펜', size: 8, min: 2, max: 40, opacity: 1, dab: 'hard', spacing: 0.1, pressureSize: 0.45, smoothing: 0.45 },
  marker: { label: '마커', size: 24, min: 6, max: 90, opacity: 0.55, dab: 'hard', spacing: 0.08, pressureSize: 0.15, smoothing: 0.4, blend: 'multiply' },
  watercolor: { label: '수채화 붓', short: '수채 붓', size: 44, min: 10, max: 140, opacity: 0.55, dab: 'soft', texture: 'paper', spacing: 0.07, pressureSize: 0.5, smoothing: 0.4, blend: 'multiply', jitter: 0.1, dabAlpha: 0.2, wetEdge: 1 },
  watercolorWide: { label: '넓은 수채화 붓', short: '넓은 붓', size: 100, min: 30, max: 260, opacity: 0.5, dab: 'flat', texture: 'paper-soft', spacing: 0.035, pressureSize: 0.3, smoothing: 0.55, blend: 'multiply', jitter: 0.04, dabAlpha: 0.13, flat: 0.3, wetEdge: 0.8 },
  flower: { label: '꽃 브러시', short: '꽃 붓', size: 42, min: 16, max: 120, opacity: 1, dab: 'flower', spacing: 0.82, pressureSize: 0.35, smoothing: 0.55 },
  spray: { label: '스프레이', size: 46, min: 10, max: 160, opacity: 1, dab: 'spray', spacing: 0.25, pressureSize: 0.3, smoothing: 0.2 },
  rainbow: { label: '무지개펜', size: 14, min: 4, max: 60, opacity: 1, dab: 'hard', spacing: 0.08, pressureSize: 0.35, smoothing: 0.4, rainbow: true },
  oil: { label: '유화 붓', size: 22, min: 4, max: 100, opacity: 1, dab: 'oil', texture: 'canvas', spacing: 0.035, pressureSize: 0.35, smoothing: 0.45, mix: true },
  smudge: { label: '스머지', size: 40, min: 10, max: 140, opacity: 1, dab: 'smudge', direct: true, noColor: true, spacing: 0.1, pressureSize: 0, smoothing: 0.45, strength: 0.65 },
  rag: { label: '헝겊', size: 80, min: 20, max: 240, opacity: 1, dab: 'rag', direct: true, erase: true, noColor: true, spacing: 0.09, pressureSize: 0.25, smoothing: 0.4, strength: 0.45 },
  eraser: { label: '지우개', size: 32, min: 4, max: 160, opacity: 1, dab: 'hard', direct: true, erase: true, noColor: true, spacing: 0.08, pressureSize: 0.3, smoothing: 0.3 },
};

// 유화 붓 호수 (1호~6호)
export const OIL_PRESETS = [
  { label: '1호', size: 8 },
  { label: '2호', size: 14 },
  { label: '3호', size: 22 },
  { label: '4호', size: 32 },
  { label: '5호', size: 46 },
  { label: '6호', size: 66 },
];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---- 종이 질감 마스크 (destination-out 패턴) ----
const textureCache = new Map();
export function textureCanvas(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  let c;
  if (kind === 'paper' || kind === 'paper-soft' || kind === 'canvas') {
    // 배경지와 같은 결(같은 타일 크기·원점)을 써서 종이와 물감 결이 맞물린다
    c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(TILE, TILE);
    const rnd = mulberry32(kind.length * 7919 + 3);
    const low = tileNoise(TILE, 96, rnd);
    const blot = tileNoise(TILE, 32, rnd);
    if (kind === 'canvas') {
      const wv = canvasWeave();
      for (let i = 0; i < TILE * TILE; i++) {
        const gap = 1 - wv[i];
        img.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, Math.pow(gap, 2) * 0.22 + (low[i] - 0.5) * 0.05)) * 255);
      }
    } else {
      const hm = watercolorHeight();
      const soft = kind === 'paper-soft';
      for (let i = 0; i < TILE * TILE; i++) {
        // 높은 곳(종이 결의 언덕)은 물감이 덜 묻고, 넓은 얼룩으로 번짐 느낌
        const peak = smoothstep(0.5, 0.95, hm[i]) * (soft ? 0.32 : 0.42);
        const wash = soft ? 0 : Math.max(0, low[i] * 0.7 + blot[i] * 0.3 - 0.5) * 0.45;
        img.data[i * 4 + 3] = Math.round(Math.min(1, peak + wash) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  } else {
    const size = 256;
    c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rnd = mulberry32(kind.length * 9973 + 17);
    const fine = tileNoise(size, 2, rnd);
    const mid = tileNoise(size, 4, rnd);
    for (let i = 0; i < size * size; i++) {
      let a = 0;
      const white = rnd();
      if (kind === 'grain-light') {
        const n = fine[i] * 0.6 + white * 0.4;
        a = n > 0.62 ? Math.min(1, (n - 0.62) / 0.25) * 0.9 : 0;
      } else if (kind === 'grain-heavy') {
        const n = mid[i] * 0.65 + fine[i] * 0.2 + white * 0.15;
        a = n > 0.5 ? Math.min(1, (n - 0.5) / 0.16) : 0;
      }
      img.data[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  textureCache.set(kind, c);
  return c;
}

// ---- 색 도우미 ----
function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

const hslStr = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${Math.round(Math.min(1, Math.max(0, s)) * 100)}%,${Math.round(Math.min(0.97, Math.max(0.03, l)) * 100)}%,${a})`;

// ---- 브러시 팁 ----
function makeSoftTip(color, stops) {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexToRgb(color);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(${r},${g},${b},${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return c;
}
const SOFT_STOPS = [[0, 1], [0.6, 0.92], [0.82, 0.6], [0.94, 0.16], [1, 0]];

// 넓은 수채화 붓: 폭 방향(y)은 거의 고르게, 양 끝과 진행 방향(x)만 부드럽게 사라지는 납작한 팁
let flatMask = null;
function makeFlatTip(color) {
  const S = 64;
  if (!flatMask) {
    flatMask = makeCanvas(S, S);
    const ctx = flatMask.getContext('2d');
    const img = ctx.createImageData(S, S);
    const rnd = mulberry32(99);
    const hair = Array.from({ length: S }, () => 0.86 + rnd() * 0.14);
    for (let y = 0; y < S; y++) {
      const v = Math.abs((y / (S - 1)) * 2 - 1);
      const across = (1 - smoothstep(0.7, 1, v)) * hair[y];
      for (let x = 0; x < S; x++) {
        const u = Math.abs((x / (S - 1)) * 2 - 1);
        const along = 1 - smoothstep(0.25, 1, u);
        const o = (y * S + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(across * along * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.drawImage(flatMask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  return c;
}

// 유화 붓: 털 결 마스크(흰색+알파)와 명암(흰/검 + 알파)을 따로 만들어 색을 입힌다
// 팁의 x축 = 붓이 나아가는 방향, y축 = 붓 폭. 털 결은 x축을 따라 길게 이어진다.
const OIL_S = 128;
function makeOilTipParts(seed) {
  const S = OIL_S;
  const rnd = mulberry32(seed);
  const n = 46;
  const bristles = Array.from({ length: n }, () => ({
    v: rnd() * 2.2 - 1.1,
    w: 0.012 + rnd() * 0.035,
    dry: rnd() < 0.22 ? 0.35 + rnd() * 0.4 : 1,
    shade: (rnd() - 0.5) * 2,
  }));
  const dens = new Float32Array(S);
  const shadeRow = new Float32Array(S);
  for (let y = 0; y < S; y++) {
    const v = (y / (S - 1)) * 2 - 1;
    let dry = 1;
    let sh = 0;
    let wsum = 0;
    for (const b of bristles) {
      const k = Math.exp(-((v - b.v) ** 2) / (2 * b.w * b.w));
      sh += k * b.shade;
      wsum += k;
      if (b.dry < 1) dry = Math.min(dry, 1 - k * (1 - b.dry));
    }
    // 붓 가장자리일수록 마른 털이 더 드러난다
    const edgeDry = smoothstep(0.55, 1, Math.abs(v));
    dens[y] = Math.max(0, Math.min(1, (0.97 - edgeDry * 0.35) * (1 - (1 - dry) * (0.4 + edgeDry * 0.6))));
    shadeRow[y] = wsum > 0.05 ? Math.max(-1, Math.min(1, sh / Math.max(1, wsum))) : 0;
  }
  const mask = makeCanvas(S, S);
  const shade = makeCanvas(S, S);
  const mi = mask.getContext('2d').createImageData(S, S);
  const si = shade.getContext('2d').createImageData(S, S);
  for (let y = 0; y < S; y++) {
    const v = (y / (S - 1)) * 2 - 1;
    for (let x = 0; x < S; x++) {
      const u = (x / (S - 1)) * 2 - 1;
      // 필버트 모양: 진행 방향(u)으로 얇고 폭(v)이 넓은 둥근 사각형
      const e = Math.pow(Math.abs(u) / 0.42, 2.6) + Math.pow(Math.abs(v), 3.2);
      const edge = 1 - smoothstep(0.8, 1, e);
      if (edge <= 0) continue;
      const o = (y * S + x) * 4;
      mi.data[o] = mi.data[o + 1] = mi.data[o + 2] = 255;
      mi.data[o + 3] = Math.round(edge * dens[y] * (0.93 + rnd() * 0.07) * 255);
      // 털 결마다 밝고 어두운 줄 + 아주 약한 결 반짝임
      const s = shadeRow[y] * 0.9 + (rnd() - 0.5) * 0.1;
      const c = s > 0 ? 255 : 0;
      si.data[o] = si.data[o + 1] = si.data[o + 2] = c;
      si.data[o + 3] = Math.round(Math.min(1, Math.abs(s)) * (s > 0 ? 0.3 : 0.26) * 255);
    }
  }
  mask.getContext('2d').putImageData(mi, 0, 0);
  shade.getContext('2d').putImageData(si, 0, 0);
  return { mask, shade };
}

let ragTipCache = null;
function ragTip() {
  if (ragTipCache) return ragTipCache;
  const S = 112;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rnd = mulberry32(31337);
  const clump = tileNoise(S, 14, rnd);
  const fine = tileNoise(S, 4, rnd);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x / (S - 1)) * 2 - 1;
      const dy = (y / (S - 1)) * 2 - 1;
      const r = Math.hypot(dx, dy);
      const fall = 1 - smoothstep(0.35, 1, r);
      if (fall <= 0) continue;
      const weave = 0.65 + 0.35 * Math.abs(Math.sin(x * 0.9) * Math.sin(y * 0.9));
      const a = fall * weave * (0.35 + clump[y * S + x] * 0.85) * (0.75 + fine[y * S + x] * 0.25);
      img.data[(y * S + x) * 4 + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  ragTipCache = c;
  return c;
}

const softMaskCache = new Map();
function softMask(d) {
  if (softMaskCache.has(d)) return softMaskCache.get(d);
  const c = makeCanvas(d, d);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, d, d);
  if (softMaskCache.size > 24) softMaskCache.clear();
  softMaskCache.set(d, c);
  return c;
}

// src의 (sx,sy,w,h)를 dst의 (dx,dy)로 1:1 복사하되 src 범위 밖은 잘라낸다 (Safari 안전)
function blit(dctx, src, sx, sy, w, h, dx, dy) {
  let x0 = sx;
  let y0 = sy;
  let x1 = sx + w;
  let y1 = sy + h;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > src.width) x1 = src.width;
  if (y1 > src.height) y1 = src.height;
  if (x1 <= x0 || y1 <= y0) return;
  dctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx), dy + (y0 - sy), x1 - x0, y1 - y0);
}

// 유화 물감 섞기용 표본: 획을 시작할 때 레이어를 작게 한 번만 읽어 둔다 (그리는 동안 읽기 없음)
export function makeSampler(src) {
  const s = Math.min(1, 220 / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return {
    sample(x, y) {
      const ix = Math.min(w - 1, Math.max(0, Math.floor(x * s)));
      const iy = Math.min(h - 1, Math.max(0, Math.floor(y * s)));
      const o = (iy * w + ix) * 4;
      const a = data[o + 3] / 255;
      return a > 0.02 ? [data[o], data[o + 1], data[o + 2], a] : null;
    },
  };
}

// ---- 꽃 브러시 ----
function drawFlower(ctx, x, y, r, rnd, base) {
  const [h, s, l] = base;
  const petals = 5 + (rnd() < 0.35 ? 1 : 0);
  const rot = rnd() * Math.PI * 2;
  const ph = h + (rnd() - 0.5) * 26;
  const ps = Math.max(0.35, s + (rnd() - 0.5) * 0.16);
  const pl = Math.min(0.8, Math.max(0.32, l + (rnd() - 0.5) * 0.14));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = hslStr(ph, ps, pl);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.52, r * 0.34, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // 꽃잎 안쪽의 밝은 결
  ctx.fillStyle = hslStr(ph, ps * 0.9, pl + 0.14, 0.55);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.26, r * 0.13, a, 0, Math.PI * 2);
    ctx.fill();
  }
  const yellowish = h > 35 && h < 75 && s > 0.3;
  ctx.fillStyle = yellowish ? '#d9731f' : '#ffcf3a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = yellowish ? 'rgba(120,50,10,0.55)' : 'rgba(214,120,20,0.6)';
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.15;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.6, r * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLeaf(ctx, x, y, len, angle, rnd) {
  const w = len * 0.38;
  const hue = 95 + rnd() * 35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = hslStr(hue, 0.5 + rnd() * 0.12, 0.38 + rnd() * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.5, w, 0, 0);
  ctx.fill();
  ctx.strokeStyle = hslStr(hue, 0.45, 0.62, 0.7);
  ctx.lineWidth = Math.max(0.8, len * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.lineTo(len * 0.82, 0);
  ctx.stroke();
  ctx.restore();
}

// ---- 스트로크 렌더러 ----
export class StrokeRenderer {
  // ctx: 그릴 대상(보통 스트로크 버퍼, direct 도구는 레이어), brush: BRUSHES 항목, color: '#rrggbb', size: px
  // extra: { sampler(유화 섞기), layerCanvas(스머지), strength(스머지·헝겊 세기 0..1) }
  begin(ctx, brush, color, size, usePressure, extra = {}) {
    this.ctx = ctx;
    this.brush = brush;
    this.color = color;
    this.size = size;
    this.usePressure = usePressure;
    this.last = null;
    this.smooth = null;
    this.residual = 0;
    this.travel = 0;
    this.dirty = null;
    this.frameDirty = null;
    this.dir = null;
    this.angle = 0;
    this.count = 0;
    this.seed = (Math.random() * 1e9) | 0;
    this.rnd = mulberry32(this.seed);
    this.strength = extra.strength ?? brush.strength ?? 1;
    this.sampler = extra.sampler || null;
    this.layerCanvas = extra.layerCanvas || null;
    this.tip = null;
    if (brush.dab === 'soft') this.tip = makeSoftTip(color, SOFT_STOPS);
    else if (brush.dab === 'flat') this.tip = makeFlatTip(color);
    else if (brush.dab === 'oil') {
      this.oilParts = makeOilTipParts(this.seed);
      this.tip = makeCanvas(OIL_S, OIL_S);
      this.base = hexToRgb(color);
      this.cur = [...this.base];
      this.tinted = null;
      this.tintOil();
    } else if (brush.dab === 'flower') {
      const [r, g, b] = hexToRgb(color);
      this.hsl = rgbToHsl(r, g, b);
      this.leafSide = this.rnd() < 0.5 ? 1 : -1;
    } else if (brush.dab === 'smudge') {
      this.patchD = Math.max(4, Math.round(size));
      this.patch = makeCanvas(this.patchD, this.patchD);
      this.pctx = this.patch.getContext('2d');
      this.tmp = makeCanvas(this.patchD, this.patchD);
      this.tctx = this.tmp.getContext('2d');
      this.patchReady = false;
    }
    ctx.fillStyle = color;
  }

  tintOil() {
    const c = this.cur.map((v) => Math.round(v));
    if (this.tinted && Math.abs(c[0] - this.tinted[0]) + Math.abs(c[1] - this.tinted[1]) + Math.abs(c[2] - this.tinted[2]) < 6) return;
    this.tinted = c;
    const t = this.tip.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, OIL_S, OIL_S);
    t.drawImage(this.oilParts.mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    t.fillRect(0, 0, OIL_S, OIL_S);
    t.globalCompositeOperation = 'source-atop';
    t.drawImage(this.oilParts.shade, 0, 0);
    t.globalCompositeOperation = 'source-over';
  }

  sizeAt(p) {
    const ps = this.usePressure ? this.brush.pressureSize || 0 : 0;
    return Math.max(0.6, this.size * (1 - ps + ps * p));
  }

  addPoint(x, y, pressure = 1) {
    const p = Math.min(1, Math.max(0.05, pressure));
    const k = this.brush.smoothing || 0;
    if (!this.smooth) this.smooth = { x, y, p };
    else {
      this.smooth = {
        x: this.smooth.x + (x - this.smooth.x) * (1 - k),
        y: this.smooth.y + (y - this.smooth.y) * (1 - k),
        p: this.smooth.p + (p - this.smooth.p) * 0.5,
      };
    }
    const pt = this.smooth;
    if (!this.last) {
      this.dab(pt.x, pt.y, pt.p);
      this.last = { ...pt };
      return;
    }
    this.segment(this.last, pt);
    this.last = { ...pt };
  }

  // 마지막 좌표까지 끌어당겨 끝맺기
  finish(x, y, pressure) {
    if (this.last && x != null) {
      const p = Math.min(1, Math.max(0.05, pressure ?? this.last.p));
      this.segment(this.last, { x, y, p });
    }
  }

  segment(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return;
    // 방향을 부드럽게 따라가야 납작한 붓이 덜컥거리지 않는다
    const ux = dx / dist;
    const uy = dy / dist;
    if (!this.dir) this.dir = { x: ux, y: uy };
    else {
      const f = Math.min(1, 0.15 + dist / 40);
      this.dir.x += (ux - this.dir.x) * f;
      this.dir.y += (uy - this.dir.y) * f;
    }
    this.angle = Math.atan2(this.dir.y, this.dir.x);
    let t = this.residual;
    while (t <= dist) {
      const f = t / dist;
      const pr = a.p + (b.p - a.p) * f;
      const step = Math.max(this.brush.dab === 'smudge' ? 1 : 0.5, this.sizeAt(pr) * this.brush.spacing);
      this.dab(a.x + dx * f, a.y + dy * f, pr);
      t += step;
    }
    this.residual = t - dist;
    this.travel += dist;
  }

  mark(x, y, r) {
    const x0 = x - r - 2;
    const y0 = y - r - 2;
    const x1 = x + r + 2;
    const y1 = y + r + 2;
    for (const key of ['dirty', 'frameDirty']) {
      const d = this[key];
      if (!d) this[key] = { x0, y0, x1, y1 };
      else {
        if (x0 < d.x0) d.x0 = x0;
        if (y0 < d.y0) d.y0 = y0;
        if (x1 > d.x1) d.x1 = x1;
        if (y1 > d.y1) d.y1 = y1;
      }
    }
  }

  takeFrameDirty() {
    const d = this.frameDirty;
    this.frameDirty = null;
    return d;
  }

  dab(x, y, p) {
    const ctx = this.ctx;
    const b = this.brush;
    let size = this.sizeAt(p);
    if (b.jitter) size *= 1 + (this.rnd() - 0.5) * 2 * b.jitter;
    const r = size / 2;
    this.count++;
    if (b.rainbow) ctx.fillStyle = `hsl(${(this.travel * 0.9 + this.seed) % 360}, 90%, 55%)`;
    switch (b.dab) {
      case 'soft':
        ctx.globalAlpha = b.dabAlpha ?? 0.3;
        ctx.drawImage(this.tip, x - r, y - r, size, size);
        ctx.globalAlpha = 1;
        break;
      case 'flat': {
        const thin = size * (b.flat || 0.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = (b.dabAlpha ?? 0.1) * (0.85 + this.rnd() * 0.3);
        ctx.drawImage(this.tip, -thin / 2, -r, thin, size);
        ctx.restore();
        break;
      }
      case 'oil': {
        if (this.sampler && this.count % 3 === 1) {
          const s = this.sampler.sample(x, y);
          const cur = this.cur;
          if (s) {
            const k = 0.11 * s[3];
            for (let i = 0; i < 3; i++) cur[i] += (s[i] - cur[i]) * k;
          }
          for (let i = 0; i < 3; i++) cur[i] += (this.base[i] - cur[i]) * 0.16;
          this.tintOil();
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = 0.88 + this.rnd() * 0.12;
        ctx.drawImage(this.tip, -r, -r, size, size);
        ctx.restore();
        break;
      }
      case 'spray': {
        const n = Math.max(6, Math.round(size * size * 0.035 * (0.4 + p * 0.6)));
        for (let i = 0; i < n; i++) {
          const ang = this.rnd() * Math.PI * 2;
          const rad = Math.sqrt(this.rnd()) * r;
          const s = 1 + this.rnd() * 1.6;
          ctx.globalAlpha = 0.35 + this.rnd() * 0.5;
          ctx.fillRect(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, s, s);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'flower': {
        const rnd = this.rnd;
        const side = (rnd() - 0.5) * size * 0.45;
        const nx = -Math.sin(this.angle);
        const ny = Math.cos(this.angle);
        const cx = x + nx * side;
        const cy = y + ny * side;
        const leaf = this.count > 1 && (this.count % 3 === 0 || rnd() < 0.12);
        if (leaf) {
          this.leafSide *= -1;
          const len = size * (0.5 + rnd() * 0.25);
          const ang = this.angle + this.leafSide * (0.7 + rnd() * 0.6) + (rnd() < 0.5 ? 0 : Math.PI);
          drawLeaf(ctx, cx, cy, len, ang, rnd);
          this.mark(cx, cy, len + 2);
        } else {
          const fr = r * (0.8 + rnd() * 0.4);
          drawFlower(ctx, cx, cy, fr, rnd, this.hsl);
          this.mark(cx, cy, fr * 1.1 + 2);
        }
        return;
      }
      case 'smudge':
        this.smudgeDab(x, y, p);
        return;
      case 'rag': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rnd() * Math.PI * 2);
        ctx.globalAlpha = Math.min(1, this.strength * 0.16 * (0.55 + 0.45 * p));
        ctx.drawImage(ragTip(), -r, -r, size, size);
        ctx.restore();
        break;
      }
      default:
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    this.mark(x, y, r);
  }

  // 손가락 문지르기: 들고 다니는 물감 조각(patch)을 조금씩 내려놓고, 아래 물감을 조금씩 묻혀 간다
  smudgeDab(x, y, p) {
    const d = this.patchD;
    const sx = Math.round(x - d / 2);
    const sy = Math.round(y - d / 2);
    const P = this.pctx;
    if (!this.patchReady) {
      P.clearRect(0, 0, d, d);
      blit(P, this.layerCanvas, sx, sy, d, d, 0, 0);
      this.patchReady = true;
      return;
    }
    const T = this.tctx;
    T.globalCompositeOperation = 'source-over';
    T.clearRect(0, 0, d, d);
    T.drawImage(this.patch, 0, 0);
    T.globalCompositeOperation = 'destination-in';
    T.drawImage(softMask(d), 0, 0);
    const ctx = this.ctx;
    ctx.globalAlpha = Math.min(1, this.strength * (0.7 + 0.3 * p));
    ctx.drawImage(this.tmp, sx, sy);
    ctx.globalAlpha = 1;
    // patch = patch*(1-k) + 아래*k  (미리 곱해진 색 공간에서 정확한 섞기)
    const k = 0.2 + (1 - this.strength) * 0.3;
    P.globalCompositeOperation = 'destination-out';
    P.globalAlpha = k;
    P.fillRect(0, 0, d, d);
    P.globalCompositeOperation = 'lighter';
    blit(P, this.layerCanvas, sx, sy, d, d, 0, 0);
    P.globalCompositeOperation = 'source-over';
    P.globalAlpha = 1;
    this.mark(sx + d / 2, sy + d / 2, d / 2 + 1);
  }
}

// 수채화가 마르면서 가장자리에 물감이 모이는 효과.
// 획을 끝낼 때 '바뀐 사각형' 안에서만 한 번 계산한다 (그리는 동안에는 읽기 없음).
export function wetEdge(canvas, r, size, amount = 1) {
  if (!r || r.w < 2 || r.h < 2) return;
  const ctx = canvas.getContext('2d');
  const f = Math.max(3, Math.min(24, Math.round(size / 4)));
  const half = makeCanvas(Math.max(1, Math.round(r.w / 2)), Math.max(1, Math.round(r.h / 2)));
  half.getContext('2d').drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, half.width, half.height);
  const small = makeCanvas(Math.max(1, Math.round(r.w / f)), Math.max(1, Math.round(r.h / f)));
  small.getContext('2d').drawImage(half, 0, 0, small.width, small.height);
  const big = makeCanvas(r.w, r.h);
  const bctx = big.getContext('2d', { willReadFrequently: true });
  bctx.drawImage(small, 0, 0, r.w, r.h);
  const blur = bctx.getImageData(0, 0, r.w, r.h).data;
  const img = ctx.getImageData(r.x, r.y, r.w, r.h);
  const d = img.data;
  const inner = 1 - 0.24 * amount;
  const rim = 1.6 * amount;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (!a) continue;
    const e = a - blur[i];
    d[i] = a * inner + (e > 0 ? e * rim : 0);
  }
  ctx.putImageData(img, r.x, r.y);
}

// 패널에 보여 줄 붓 자국 미리보기
export function renderBrushSample(canvas, brushKey, color, size, opacity, strength) {
  const brush = BRUSHES[brushKey];
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!brush) return;
  const s = Math.max(1.5, Math.min(h * 0.62, size * (brush.dab === 'flower' ? 0.8 : 0.55)));
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push({ x: w * 0.08 + t * w * 0.84, y: h / 2 + Math.sin(t * Math.PI * 2) * h * 0.2, p: 0.35 + Math.sin(t * Math.PI) * 0.65 });
  }
  const r = new StrokeRenderer();
  if (brush.direct) {
    // 물감 줄무늬 위에 문지르기/지우기를 보여 준다
    const bands = ['#ff6b6b', '#ffd43b', '#4dabf7'];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (h / 3) * i, w, h / 3 + 1);
    });
    ctx.save();
    ctx.globalCompositeOperation = brush.erase ? 'destination-out' : 'source-over';
    r.begin(ctx, brush, '#000000', s, true, { strength, layerCanvas: canvas });
    for (const pt of pts) r.addPoint(pt.x, pt.y, pt.p);
    ctx.restore();
    return;
  }
  const buf = makeCanvas(w, h);
  const bctx = buf.getContext('2d');
  r.begin(bctx, brush, color, s, true);
  for (const pt of pts) r.addPoint(pt.x, pt.y, pt.p);
  if (brush.texture) {
    bctx.globalCompositeOperation = 'destination-out';
    bctx.fillStyle = bctx.createPattern(textureCanvas(brush.texture), 'repeat');
    bctx.fillRect(0, 0, w, h);
    bctx.globalCompositeOperation = 'source-over';
  }
  if (brush.wetEdge) wetEdge(buf, { x: 0, y: 0, w, h }, s, brush.wetEdge);
  ctx.globalAlpha = opacity;
  ctx.drawImage(buf, 0, 0);
  ctx.globalAlpha = 1;
}
