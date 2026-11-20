// 도안 불러오기: 기본 SVG 도안 / 서버 저장 도안 → 캔버스 크기에 맞춘 "선 레이어"
import { BUILTIN_TEMPLATES } from '/shared/builtin-templates.js';

export { BUILTIN_TEMPLATES };

export function builtinById(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
}

export function svgDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    img.src = src;
  });
}

// 흰 바탕을 투명하게 바꾸고 어두운 선만 남긴다 (흰 면이 색칠을 가리지 않도록)
export function toLineLayer(source, W, H, { fit = 'contain', margin = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  const scale = fit === 'contain' ? Math.min((W - margin * 2) / sw, (H - margin * 2) / sh) : Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a = Math.max(0, Math.min(255, (255 - lum) * 1.25));
    d[i] = 34;
    d[i + 1] = 34;
    d[i + 2] = 34;
    d[i + 3] = a < 18 ? 0 : a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function templateSource(ref) {
  if (!ref) return null;
  if (ref.startsWith('builtin:')) {
    const t = builtinById(ref);
    if (!t) return null;
    return { title: t.title, image: await loadImage(svgDataUrl(t.svg)) };
  }
  if (ref.startsWith('t:')) {
    const id = Number(ref.slice(2));
    return { title: '내 도안', image: await loadImage(`/api/templates/${id}/image`) };
  }
  return null;
}

export async function loadTemplateLayer(ref, W, H) {
  const src = await templateSource(ref);
  if (!src) return null;
  return { title: src.title, canvas: toLineLayer(src.image, W, H, { margin: Math.round(Math.min(W, H) * 0.02) }) };
}

export function templateThumbSrc(ref) {
  if (!ref) return null;
  if (ref.startsWith('builtin:')) {
    const t = builtinById(ref);
    return t ? svgDataUrl(t.svg) : null;
  }
  if (ref.startsWith('t:')) return `/api/templates/${Number(ref.slice(2))}/image?thumb=1`;
  return null;
}

// SVG 문자열 → PNG dataURL (도안 저장용)
export async function svgToPng(svg, W = 1600, H = 1200) {
  const img = await loadImage(svgDataUrl(svg));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return c;
}

export function canvasThumb(canvas, maxSide = 480, type = 'image/jpeg', quality = 0.85) {
  const s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * s));
  c.height = Math.max(1, Math.round(canvas.height * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL(type, quality);
}
