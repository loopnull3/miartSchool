// 도안을 자동으로 색칠하는 애니메이션 (랜딩 히어로 · 데모 데이터 생성용)
import { toLineLayer, loadImage, svgDataUrl } from './templates.js';
import { floodFill } from './studio/fill.js';

const PALETTE = ['#ff9f0a', '#ff6b4a', '#ffd60a', '#34c759', '#5ac8fa', '#0a84ff', '#bf5af2', '#ff375f', '#64d2ff', '#30d158', '#ffb340', '#ac8e68'];

// 선이 아닌 연결 영역 찾기 (축소본에서)
function findRegions(barrier, W, H, step = 3) {
  const w = Math.floor(W / step);
  const h = Math.floor(H / step);
  const open = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) open[y * w + x] = barrier[y * step * W + x * step] ? 0 : 1;
  const seen = new Uint8Array(w * h);
  const regions = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!open[i] || seen[i]) continue;
    let sp = 0;
    let n = 0;
    let top = false;
    let bottom = false;
    let side = false;
    stack[sp++] = i;
    seen[i] = 1;
    while (sp) {
      const j = stack[--sp];
      n++;
      const x = j % w;
      const y = (j / w) | 0;
      if (y === 0) top = true;
      if (y === h - 1) bottom = true;
      if (x === 0 || x === w - 1) side = true;
      const nb = [j - 1, j + 1, j - w, j + w];
      for (let k = 0; k < 4; k++) {
        const q = nb[k];
        if (q < 0 || q >= w * h) continue;
        if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) continue;
        if (open[q] && !seen[q]) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
    }
    if (n * step * step < 120) continue;
    regions.push({ x: (i % w) * step + 1, y: ((i / w) | 0) * step + 1, area: n * step * step, top, bottom, side });
  }
  return regions;
}

export async function prepareColoring(svg, W, H, { seed = 1 } = {}) {
  const img = await loadImage(svgDataUrl(svg));
  const lines = toLineLayer(img, W, H, { margin: 0 });
  const ld = lines.getContext('2d').getImageData(0, 0, W, H).data;
  const barrier = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) barrier[i] = ld[i * 4 + 3] > 90 ? 1 : 0;
  const regions = findRegions(barrier, W, H).sort((a, b) => b.area - a.area);
  let k = seed;
  const plan = regions.map((r, idx) => {
    let color;
    if (idx === 0 && (r.top || r.side)) color = '#dff1ff';
    else if (r.bottom && r.area > W * H * 0.04) color = '#c8f0c0';
    else color = PALETTE[(k++ * 5) % PALETTE.length];
    return { ...r, color };
  });
  return { lines, barrier, plan };
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 화면 캔버스에 색칠 애니메이션. stop() 반환
export function animateColoring(canvas, svgs, { interval = 150, hold = 2600 } = {}) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const paint = document.createElement('canvas');
  paint.width = W;
  paint.height = H;
  const pctx = paint.getContext('2d', { willReadFrequently: true });
  const white = new ImageData(W, H);
  white.data.fill(255);
  let stopped = false;
  let timer = 0;
  let idx = 0;

  const draw = (lines) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(paint, 0, 0);
    ctx.drawImage(lines, 0, 0);
  };

  async function run() {
    if (stopped) return;
    const svg = svgs[idx % svgs.length];
    idx++;
    const { lines, barrier, plan } = await prepareColoring(svg, W, H, { seed: idx });
    pctx.clearRect(0, 0, W, H);
    draw(lines);
    let i = 0;
    const tick = () => {
      if (stopped) return;
      if (i >= plan.length) {
        timer = setTimeout(run, hold);
        return;
      }
      const r = plan[i++];
      floodFill({ ref: white, barrier, target: pctx, width: W, height: H, x: r.x, y: r.y, color: hex(r.color), tolerance: 10 });
      draw(lines);
      timer = setTimeout(tick, interval);
    };
    timer = setTimeout(tick, 500);
  }
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// 데모용: 도안을 한 번에 색칠한 캔버스 반환
export async function colorAll(svg, W, H, seed = 1) {
  const { lines, barrier, plan } = await prepareColoring(svg, W, H, { seed });
  const paint = document.createElement('canvas');
  paint.width = W;
  paint.height = H;
  const pctx = paint.getContext('2d', { willReadFrequently: true });
  const white = new ImageData(W, H);
  white.data.fill(255);
  for (const r of plan) floodFill({ ref: white, barrier, target: pctx, width: W, height: H, x: r.x, y: r.y, color: hex(r.color), tolerance: 10 });
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const o = out.getContext('2d');
  o.fillStyle = '#fff';
  o.fillRect(0, 0, W, H);
  o.drawImage(paint, 0, 0);
  o.drawImage(lines, 0, 0);
  return out;
}
