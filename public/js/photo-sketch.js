// 사진 → 색칠 도안(선화) 변환 — 브라우저에서 바로 처리 (서버 전송 없음)
// 그레이스케일 → 자동 대비 → DoG(가우시안 차) 윤곽 → 잡티 제거 → 선 굵기 → 부드러운 가장자리

function boxesForGauss(sigma, n = 3) {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}

function boxBlurH(src, dst, w, h, r) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < h; i++) {
    let ti = i * w;
    let li = ti;
    let ri = ti + r;
    const fv = src[ti];
    const lv = src[ti + w - 1];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + Math.min(j, w - 1)];
    for (let j = 0; j <= r; j++) {
      val += src[Math.min(ri++, ti + w - 1)] - fv;
      dst[ti++] = val * iarr;
    }
    for (let j = r + 1; j < w - r; j++) {
      val += src[ri++] - src[li++];
      dst[ti++] = val * iarr;
    }
    for (let j = w - r; j < w; j++) {
      val += lv - src[li++];
      dst[ti++] = val * iarr;
    }
  }
}

function boxBlurV(src, dst, w, h, r) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < w; i++) {
    let ti = i;
    let li = ti;
    let ri = ti + r * w;
    const fv = src[ti];
    const lv = src[ti + w * (h - 1)];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + Math.min(j, h - 1) * w];
    for (let j = 0; j <= r; j++) {
      val += src[Math.min(ri, ti + w * (h - 1))] - fv;
      ri += w;
      dst[ti] = val * iarr;
      ti += w;
    }
    for (let j = r + 1; j < h - r; j++) {
      val += src[ri] - src[li];
      ri += w;
      li += w;
      dst[ti] = val * iarr;
      ti += w;
    }
    for (let j = h - r; j < h; j++) {
      val += lv - src[li];
      li += w;
      dst[ti] = val * iarr;
      ti += w;
    }
  }
}

export function gaussianBlur(src, w, h, sigma) {
  if (sigma <= 0.01) return Float32Array.from(src);
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  for (const size of boxesForGauss(sigma, 3)) {
    const r = Math.max(0, (size - 1) / 2);
    if (r < 1) continue;
    boxBlurH(a, b, w, h, Math.min(r, Math.floor((w - 1) / 2)));
    boxBlurV(b, a, w, h, Math.min(r, Math.floor((h - 1) / 2)));
  }
  return a;
}

function removeSmallComponents(mask, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0;
    let n = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp) {
      const i = stack[--sp];
      comp[n++] = i;
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack[sp++] = j;
          }
        }
      }
    }
    if (n < minArea) for (let k = 0; k < n; k++) mask[comp[k]] = 0;
  }
}

function dilate(mask, w, h) {
  const out = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) out[i] = 1;
    }
  }
  return out;
}

/**
 * @param {CanvasImageSource} source 사진
 * @param {{detail?: number, thickness?: number, maxSide?: number}} o
 *   detail 0~1 (높을수록 세밀한 선), thickness 1~5
 * @returns {HTMLCanvasElement} 흰 바탕 검은 선 캔버스
 */
export function photoToLineArt(source, { detail = 0.5, thickness = 2, maxSide = 1200 } = {}) {
  const sw = source.naturalWidth || source.videoWidth || source.width;
  const sh = source.naturalHeight || source.videoHeight || source.height;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * s));
  const h = Math.max(8, Math.round(sh * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  // 1) 채널별(R·G·B) 자동 대비 (2%~98% 구간 늘이기) — 밝기 차이가 작아도 색 차이가 있는 윤곽을 잡기 위해
  const channels = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 3; c++) {
    const ch = channels[c];
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      ch[i] = d[i * 4 + c];
      hist[d[i * 4 + c]]++;
    }
    let lo = 0;
    let hi = 255;
    for (let acc = 0, k = 0; k < 256; k++) {
      acc += hist[k];
      if (acc > n * 0.02) {
        lo = k;
        break;
      }
    }
    for (let acc = 0, k = 255; k >= 0; k--) {
      acc += hist[k];
      if (acc > n * 0.02) {
        hi = k;
        break;
      }
    }
    const range = Math.max(48, hi - lo);
    for (let i = 0; i < n; i++) ch[i] = Math.min(255, Math.max(0, ((ch[i] - lo) / range) * 255));
  }

  // 2) 잡음 줄이기 + 채널별 DoG(가우시안 차) → 어느 채널이든 윤곽이면 선
  const scale = Math.max(w, h) / 1000;
  const det = Math.min(1, Math.max(0, detail));
  const sigma = (2.6 - 1.7 * det) * Math.max(0.6, scale);
  const threshold = 7 - 4.5 * det;
  const mask = new Uint8Array(n);
  for (const ch of channels) {
    const base = gaussianBlur(ch, w, h, 0.8 * Math.max(0.6, scale));
    const g1 = gaussianBlur(base, w, h, sigma);
    const g2 = gaussianBlur(base, w, h, sigma * 1.6);
    for (let i = 0; i < n; i++) if (g1[i] - g2[i] < -threshold) mask[i] = 1;
  }

  // 3) 잡티 제거
  removeSmallComponents(mask, w, h, Math.round((90 - 70 * det) * scale * scale + 6));

  // 4) 굵기
  let m = mask;
  for (let k = 1; k < Math.round(thickness); k++) m = dilate(m, w, h);

  // 5) 부드러운 가장자리
  const soft = gaussianBlur(Float32Array.from(m, (v) => v * 255), w, h, 0.7);
  for (let i = 0; i < n; i++) {
    const a = Math.min(255, soft[i] * 1.6);
    const v = 255 - a * (221 / 255);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function fileToImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
