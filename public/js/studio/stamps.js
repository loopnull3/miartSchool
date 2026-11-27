// 도장 모양 — 그림 문자(이모지) 대신 직접 그리는 모양. 100×100 상자 안의 SVG 경로로 정의해서
// 캔버스(Path2D)와 패널 미리보기(인라인 SVG)가 같은 모양을 쓴다. 색은 고른 색과 그 밝은/어두운 톤.
// 부분: { d, fill?, stroke?, w? }  색 기호: c=고른 색, l=밝은 톤, d=어두운 톤, w=반짝임(흰색 반투명)

const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

function starD(cx, cy, ro, ri, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 ? ri : ro;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function ring(n, dist, r, cx = 50, cy = 50, rot = -90) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    d += circ(+(cx + Math.cos(a) * dist).toFixed(1), +(cy + Math.sin(a) * dist).toFixed(1), r);
  }
  return d;
}

function rays(n, r0, r1, cx = 50, cy = 50) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d += `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}`;
  }
  return d;
}

export const STAMP_SHAPES = {
  star: { label: '별', parts: [{ d: starD(50, 53, 44, 21), fill: 'c', stroke: 'c', w: 8 }, { d: ell(38, 40, 6, 4), fill: 'w' }] },
  heart: { label: '하트', parts: [{ d: 'M50 88C22 68 6 50 12 30 17 13 40 9 50 27 60 9 83 13 88 30 94 50 78 68 50 88Z', fill: 'c' }, { d: ell(30, 32, 7, 5), fill: 'w' }] },
  flower: { label: '꽃', parts: [{ d: ring(5, 25, 18), fill: 'c' }, { d: circ(50, 50, 15), fill: 'l' }, { d: circ(46, 46, 4), fill: 'w' }] },
  leaf: { label: '잎', parts: [{ d: 'M16 84C14 44 42 16 88 12 86 56 58 84 16 84Z', fill: 'c' }, { d: 'M22 78C40 60 58 42 78 22M44 56 40 38M58 42 66 46M34 66 24 58', stroke: 'l', w: 4 }] },
  cloud: { label: '구름', parts: [{ d: 'M26 76H74A18 18 0 0 0 76 40 26 26 0 0 0 28 36 20 20 0 0 0 26 76Z', fill: 'c' }, { d: ell(42, 44, 9, 5), fill: 'w' }] },
  sparkle: { label: '반짝', parts: [{ d: 'M44 8C47 34 56 44 82 47 56 50 47 60 44 86 41 60 32 50 6 47 32 44 41 34 44 8Z', fill: 'c' }, { d: 'M80 62C81 72 84 75 94 76 84 77 81 80 80 90 79 80 76 77 66 76 76 75 79 72 80 62Z', fill: 'l' }] },
  moon: { label: '달', parts: [{ d: 'M60 10A42 42 0 1 0 90 66 34 34 0 1 1 60 10Z', fill: 'c' }, { d: circ(36, 62, 5) + circ(48, 78, 3.5), fill: 'd' }, { d: ell(30, 40, 5, 8), fill: 'w' }] },
  sun: { label: '해', parts: [{ d: rays(10, 31, 44), stroke: 'c', w: 8 }, { d: circ(50, 50, 23), fill: 'c' }, { d: ell(42, 42, 7, 5), fill: 'w' }] },
  note: { label: '음표', parts: [{ d: 'M33 22 82 12V70H74V28L41 35V80H33Z', fill: 'c', stroke: 'c', w: 3 }, { d: ell(26, 80, 14, 10) + ell(67, 70, 14, 10), fill: 'c' }, { d: ell(22, 76, 4, 3) + ell(63, 66, 4, 3), fill: 'w' }] },
  paw: { label: '발자국', parts: [{ d: 'M50 50C64 50 80 66 78 78 76 90 62 86 50 86 38 86 24 90 22 78 20 66 36 50 50 50Z', fill: 'c' }, { d: ell(20, 44, 9, 12) + ell(38, 24, 9, 12) + ell(62, 24, 9, 12) + ell(80, 44, 9, 12), fill: 'c' }] },
  butterfly: { label: '나비', parts: [{ d: ell(30, 34, 20, 18) + ell(70, 34, 20, 18), fill: 'c' }, { d: ell(33, 66, 15, 14) + ell(67, 66, 15, 14), fill: 'l' }, { d: 'M50 26V80', stroke: 'd', w: 8 }, { d: 'M48 26Q42 12 34 10M52 26Q58 12 66 10', stroke: 'd', w: 3 }, { d: circ(28, 32, 5) + circ(72, 32, 5), fill: 'w' }] },
  fish: { label: '물고기', parts: [{ d: 'M8 50C24 26 58 24 76 50 58 76 24 74 8 50Z', fill: 'c' }, { d: 'M72 50 94 30V70Z', fill: 'c', stroke: 'c', w: 4 }, { d: 'M40 40Q48 50 40 60', stroke: 'l', w: 4 }, { d: circ(24, 46, 5.5), fill: '#ffffff' }, { d: circ(25, 46, 2.8), fill: 'd' }] },
  apple: { label: '사과', parts: [{ d: 'M50 32C36 22 14 28 14 52 14 74 32 92 44 90 48 89 52 89 56 90 68 92 86 74 86 52 86 28 64 22 50 32Z', fill: 'c' }, { d: 'M50 32Q49 18 56 8', stroke: 'd', w: 5 }, { d: 'M54 22C58 10 72 8 80 14 74 24 62 26 54 22Z', fill: 'd' }, { d: ell(30, 48, 6, 10), fill: 'w' }] },
  balloon: { label: '풍선', parts: [{ d: 'M50 8C30 8 18 24 18 42 18 62 36 76 50 76 64 76 82 62 82 42 82 24 70 8 50 8Z', fill: 'c' }, { d: 'M44 82 50 75 56 82Z', fill: 'c' }, { d: 'M50 82Q44 88 52 94', stroke: 'd', w: 2.5 }, { d: ell(36, 28, 6, 10), fill: 'w' }] },
  clover: { label: '클로버', parts: [{ d: circ(36, 36, 16) + circ(64, 36, 16) + circ(36, 64, 16) + circ(64, 64, 16), fill: 'c' }, { d: 'M58 58Q70 80 64 94', stroke: 'd', w: 5 }, { d: circ(50, 50, 7), fill: 'l' }] },
  drop: { label: '물방울', parts: [{ d: 'M50 6C50 6 18 46 18 64A32 32 0 0 0 82 64C82 46 50 6 50 6Z', fill: 'c' }, { d: ell(36, 62, 6, 11), fill: 'w' }] },
  crown: { label: '왕관', parts: [{ d: 'M14 72 10 28 32 46 50 18 68 46 90 28 86 72Z', fill: 'c', stroke: 'c', w: 6 }, { d: 'M14 72H86V86H14Z', fill: 'd', stroke: 'd', w: 4 }, { d: circ(50, 58, 6) + circ(30, 62, 4) + circ(70, 62, 4), fill: 'l' }] },
  bow: { label: '리본', parts: [{ d: 'M50 48 14 26C8 24 6 30 6 48 6 66 8 72 14 70ZM50 48 86 26C92 24 94 30 94 48 94 66 92 72 86 70Z', fill: 'c', stroke: 'c', w: 4 }, { d: 'M44 54 30 90 40 86 46 94 50 58ZM56 54 70 90 60 86 54 94 50 58Z', fill: 'd' }, { d: ell(50, 48, 11, 13), fill: 'l' }] },
};
export const STAMP_ORDER = Object.keys(STAMP_SHAPES);

function rgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
export function stampTones(hex) {
  const c = rgb(hex);
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return {
    c: hex,
    l: lum > 0.85 ? mix(c, [0, 0, 0], 0.12) : mix(c, [255, 255, 255], 0.5),
    d: lum < 0.18 ? mix(c, [255, 255, 255], 0.3) : mix(c, [0, 0, 0], 0.28),
    w: lum > 0.85 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.42)',
  };
}

const paths = new Map();
function path2d(d) {
  if (!paths.has(d)) paths.set(d, new Path2D(d));
  return paths.get(d);
}

// (cx, cy)를 가운데로 size 크기의 도장을 찍는다
export function drawStamp(ctx, key, cx, cy, size, color) {
  const shape = STAMP_SHAPES[key] || STAMP_SHAPES.star;
  const t = stampTones(color);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of shape.parts) {
    const pp = path2d(p.d);
    if (p.fill) {
      ctx.fillStyle = t[p.fill] || p.fill;
      ctx.fill(pp);
    }
    if (p.stroke) {
      ctx.strokeStyle = t[p.stroke] || p.stroke;
      ctx.lineWidth = p.w || 4;
      ctx.stroke(pp);
    }
  }
  ctx.restore();
}

export function stampSvg(key, color, px = 30) {
  const shape = STAMP_SHAPES[key] || STAMP_SHAPES.star;
  const t = stampTones(color);
  const body = shape.parts
    .map((p) => `<path d="${p.d}" fill="${p.fill ? t[p.fill] || p.fill : 'none'}"${p.stroke ? ` stroke="${t[p.stroke] || p.stroke}" stroke-width="${p.w || 4}" stroke-linejoin="round" stroke-linecap="round"` : ''}/>`)
    .join('');
  return `<svg viewBox="-6 -6 112 112" width="${px}" height="${px}" aria-hidden="true">${body}</svg>`;
}
