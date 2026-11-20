// 브러시 정의와 스트로크 렌더러 (스탬프 방식)
export const BRUSHES = {
  pencil: { label: '연필', icon: '✏️', size: 4, min: 1, max: 30, opacity: 0.92, dab: 'hard', texture: 'grain-light', spacing: 0.2, pressureSize: 0.55, smoothing: 0.35 },
  pen: { label: '사인펜', icon: '🖊️', size: 8, min: 2, max: 40, opacity: 1, dab: 'hard', spacing: 0.1, pressureSize: 0.45, smoothing: 0.45 },
  crayon: { label: '크레파스', icon: '🖍️', size: 18, min: 6, max: 70, opacity: 0.96, dab: 'hard', texture: 'grain-heavy', spacing: 0.12, pressureSize: 0.35, smoothing: 0.3 },
  marker: { label: '마커', icon: '🖌️', size: 24, min: 6, max: 90, opacity: 0.55, dab: 'hard', spacing: 0.08, pressureSize: 0.15, smoothing: 0.4, blend: 'multiply' },
  watercolor: { label: '수채화', icon: '💧', size: 44, min: 10, max: 140, opacity: 0.5, dab: 'soft', texture: 'paper', spacing: 0.07, pressureSize: 0.5, smoothing: 0.4, blend: 'multiply', jitter: 0.12, dabAlpha: 0.22 },
  oil: { label: '유화', icon: '🎨', size: 30, min: 8, max: 100, opacity: 1, dab: 'bristle', texture: 'canvas', spacing: 0.05, pressureSize: 0.45, smoothing: 0.4 },
  spray: { label: '스프레이', icon: '💨', size: 46, min: 10, max: 160, opacity: 1, dab: 'spray', spacing: 0.25, pressureSize: 0.3, smoothing: 0.2 },
  rainbow: { label: '무지개펜', icon: '🌈', size: 14, min: 4, max: 60, opacity: 1, dab: 'hard', spacing: 0.08, pressureSize: 0.35, smoothing: 0.4, rainbow: true },
  eraser: { label: '지우개', icon: '🧽', size: 32, min: 4, max: 160, opacity: 1, dab: 'hard', spacing: 0.08, pressureSize: 0.3, smoothing: 0.3, erase: true },
};

// ---- 종이 질감 마스크 (destination-out 패턴) ----
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(size, cell, rnd) {
  const g = Math.ceil(size / cell);
  const grid = new Float32Array(g * g).map(() => rnd());
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

const textureCache = new Map();
export function textureCanvas(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(kind.length * 9973 + 17);
  const fine = valueNoise(size, 2, rnd);
  const mid = valueNoise(size, 4, rnd);
  const low = valueNoise(size, 32, rnd);
  for (let i = 0; i < size * size; i++) {
    let a = 0;
    const white = rnd();
    if (kind === 'grain-light') {
      const n = fine[i] * 0.6 + white * 0.4;
      a = n > 0.62 ? Math.min(1, (n - 0.62) / 0.25) * 0.9 : 0;
    } else if (kind === 'grain-heavy') {
      const n = mid[i] * 0.65 + fine[i] * 0.2 + white * 0.15;
      a = n > 0.5 ? Math.min(1, (n - 0.5) / 0.16) : 0;
    } else if (kind === 'paper') {
      const n = low[i] * 0.7 + fine[i] * 0.3;
      a = Math.max(0, n - 0.35) * 0.55;
    } else if (kind === 'canvas') {
      const x = i % size;
      const y = (i / size) | 0;
      const weave = (Math.sin((x * Math.PI) / 3) * Math.sin((y * Math.PI) / 3) + 1) / 2;
      a = weave * 0.28 + fine[i] * 0.12;
    }
    img.data[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
  }
  ctx.putImageData(img, 0, 0);
  textureCache.set(kind, c);
  return c;
}

// ---- 브러시 팁 ----
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeSoftTip(color) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const [r, g, b] = hexToRgb(color);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.75)`);
  grad.addColorStop(0.85, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return c;
}

function makeBristleTip(color, seed) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const [r, g, b] = hexToRgb(color);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(s / 2, s / 2, s / 2 - 1, s / 2 - 1, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 22; i++) {
    const y = rnd() * s;
    const shade = (rnd() - 0.5) * 50;
    const cr = Math.max(0, Math.min(255, r + shade));
    const cg = Math.max(0, Math.min(255, g + shade));
    const cb = Math.max(0, Math.min(255, b + shade));
    ctx.strokeStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${0.5 + rnd() * 0.5})`;
    ctx.lineWidth = 1.5 + rnd() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y + (rnd() - 0.5) * 4);
    ctx.stroke();
  }
  ctx.restore();
  return c;
}

// ---- 스트로크 렌더러 ----
export class StrokeRenderer {
  // ctx: 그릴 대상 (보통 스트로크 버퍼), brush: BRUSHES 항목, color: '#rrggbb', size: px
  begin(ctx, brush, color, size, usePressure) {
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
    this.angle = 0;
    this.seed = (Math.random() * 1e9) | 0;
    this.rnd = mulberry32(this.seed);
    if (brush.dab === 'soft') this.tip = makeSoftTip(color);
    else if (brush.dab === 'bristle') this.tip = makeBristleTip(color, this.seed);
    else this.tip = null;
    ctx.fillStyle = color;
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
    this.angle = Math.atan2(dy, dx);
    let t = this.residual;
    while (t <= dist) {
      const f = t / dist;
      const pr = a.p + (b.p - a.p) * f;
      const step = Math.max(0.5, this.sizeAt(pr) * this.brush.spacing);
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
    if (!this.dirty) this.dirty = { x0, y0, x1, y1 };
    else {
      const d = this.dirty;
      if (x0 < d.x0) d.x0 = x0;
      if (y0 < d.y0) d.y0 = y0;
      if (x1 > d.x1) d.x1 = x1;
      if (y1 > d.y1) d.y1 = y1;
    }
    if (!this.frameDirty) this.frameDirty = { x0, y0, x1, y1 };
    else {
      const d = this.frameDirty;
      if (x0 < d.x0) d.x0 = x0;
      if (y0 < d.y0) d.y0 = y0;
      if (x1 > d.x1) d.x1 = x1;
      if (y1 > d.y1) d.y1 = y1;
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
    if (b.rainbow) ctx.fillStyle = `hsl(${(this.travel * 0.9 + this.seed) % 360}, 90%, 55%)`;
    switch (b.dab) {
      case 'soft':
        ctx.globalAlpha = b.dabAlpha ?? 0.3;
        ctx.drawImage(this.tip, x - r, y - r, size, size);
        ctx.globalAlpha = 1;
        break;
      case 'bristle':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = 0.85 + this.rnd() * 0.15;
        ctx.drawImage(this.tip, -r, -r, size, size);
        ctx.restore();
        break;
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
      default:
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    this.mark(x, y, r);
  }
}
