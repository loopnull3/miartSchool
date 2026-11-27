// QR 코드 — 만들기(SVG · PNG) · 사진/카메라로 읽기
// 외부 CDN 없이 /vendor 의 라이브러리를 필요할 때만 불러온다.
//   만들기: qrcode-generator (ES 모듈, MIT)
//   읽기:   BarcodeDetector(지원 브라우저) → 없으면 jsQR (UMD 스크립트, Apache-2.0)
//
// 사용 예
//   import { qrSvg, qrDataUrl, createScanner, decodeQr } from '/js/qr.js';
//   el.innerHTML = await qrSvg('https://school.example/#/qr/AB12CD', { size: 180 });
//   const scanner = createScanner(box, { onResult: (text) => …, onError: (err) => … });
//   await scanner.start();   …   scanner.stop();

const VENDOR = new URL('../vendor/', import.meta.url);
const QRGEN_URL = new URL('qrcode-generator/qrcode.mjs', VENDOR).href;
const JSQR_URL = new URL('jsqr/jsQR.js', VENDOR).href;

// ───────────────────────── 라이브러리 지연 로딩 ─────────────────────────

let qrGenPromise = null;
function loadQrGenerator() {
  if (!qrGenPromise) {
    qrGenPromise = import(QRGEN_URL)
      .then((m) => {
        const fn = m.default || m.qrcode;
        if (typeof fn !== 'function') throw new Error('qrcode-generator 형식이 올바르지 않아요.');
        return fn;
      })
      .catch((e) => {
        qrGenPromise = null;
        throw qrError('load', 'QR 코드 모듈을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', e);
      });
  }
  return qrGenPromise;
}

let jsQrPromise = null;
function loadJsQR() {
  if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
  if (!jsQrPromise) {
    jsQrPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_URL;
      s.async = true;
      s.dataset.qrVendor = 'jsqr';
      s.onload = () => {
        if (typeof window.jsQR === 'function') resolve(window.jsQR);
        else reject(new Error('jsQR 전역 함수가 없어요.'));
      };
      s.onerror = () => reject(new Error('jsQR 스크립트를 불러오지 못했어요.'));
      document.head.appendChild(s);
    }).catch((e) => {
      jsQrPromise = null;
      document.querySelectorAll('script[data-qr-vendor="jsqr"]').forEach((el) => el.remove());
      throw qrError('load', 'QR 인식 모듈을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', e);
    });
  }
  return jsQrPromise;
}

let nativeDetectorPromise = null;
// BarcodeDetector(qr_code)를 쓸 수 있으면 detector, 아니면 null
function getNativeDetector() {
  if (!nativeDetectorPromise) {
    nativeDetectorPromise = (async () => {
      const BD = typeof window !== 'undefined' ? window.BarcodeDetector : undefined;
      if (typeof BD !== 'function') return null;
      try {
        if (typeof BD.getSupportedFormats === 'function') {
          const formats = await BD.getSupportedFormats();
          if (!formats || !formats.includes('qr_code')) return null;
        }
        return new BD({ formats: ['qr_code'] });
      } catch {
        return null;
      }
    })();
  }
  return nativeDetectorPromise;
}

function qrError(code, message, cause) {
  const err = new Error(message);
  err.name = 'QrError';
  err.code = code;
  if (cause !== undefined) err.cause = cause;
  return err;
}

// ───────────────────────── QR 만들기 ─────────────────────────

const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
const ALNUM_RE = /^[0-9A-Z $%*+\-./:]+$/;

function escAttr(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// UTF-8 바이트를 0~255 코드 문자열로 — 라이브러리 기본 변환(c & 0xff)이 그대로 바이트가 된다
function toByteString(text) {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x2000));
  }
  return out;
}

// 모듈 행렬(boolean[][])을 만든다
async function qrMatrix(text, ecc = 'M') {
  const qrcode = await loadQrGenerator();
  const value = String(text ?? '');
  if (!value) throw qrError('empty', 'QR 코드에 넣을 내용이 없어요.');
  const level = ECC_LEVELS.includes(String(ecc).toUpperCase()) ? String(ecc).toUpperCase() : 'M';
  const qr = qrcode(0, level);
  try {
    if (/^[0-9]+$/.test(value)) qr.addData(value, 'Numeric');
    else if (ALNUM_RE.test(value)) qr.addData(value, 'Alphanumeric');
    else qr.addData(toByteString(value), 'Byte');
    qr.make();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/overflow/i.test(msg)) throw qrError('too-long', 'QR 코드에 담기엔 내용이 너무 길어요.', e);
    throw qrError('encode', 'QR 코드를 만들지 못했어요.', e);
  }
  const n = qr.getModuleCount();
  const rows = new Array(n);
  for (let r = 0; r < n; r++) {
    const row = new Array(n);
    for (let c = 0; c < n; c++) row[c] = qr.isDark(r, c);
    rows[r] = row;
  }
  return rows;
}

/**
 * QR 코드를 SVG 문자열로 만든다 (흰 배경, 정사각 모듈, crispEdges).
 * @param {string} text  담을 내용 (UTF-8 · 한글 가능)
 * @param {{size?: number|null, margin?: number, ecc?: 'L'|'M'|'Q'|'H', color?: string,
 *          background?: string, label?: string}} [opts]
 *   size: 픽셀 폭·높이 (null 이면 width/height 를 빼서 CSS 로 크기 조절)
 *   margin: 여백(모듈 수) — 인쇄용은 4 권장
 * @returns {Promise<string>}
 */
export async function qrSvg(text, { size = 200, margin = 2, ecc = 'M', color = '#1d1d1f', background = '#ffffff', label = 'QR 코드' } = {}) {
  const m = await qrMatrix(text, ecc);
  const n = m.length;
  const q = Math.max(0, Math.floor(Number(margin) || 0));
  const total = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    const row = m[r];
    let c = 0;
    while (c < n) {
      if (!row[c]) { c++; continue; }
      const start = c;
      while (c < n && row[c]) c++;
      const w = c - start;
      d += `M${start + q} ${r + q}h${w}v1h-${w}z`;
    }
  }
  const px = Number(size);
  const dim = size != null && px > 0 ? ` width="${px}" height="${px}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"${dim} shape-rendering="crispEdges" role="img" aria-label="${escAttr(label)}">` +
    `<rect width="${total}" height="${total}" fill="${escAttr(background)}"/>` +
    `<path d="${d}" fill="${escAttr(color)}"/>` +
    `</svg>`
  );
}

/**
 * QR 코드를 PNG data URL 로 만든다 (인쇄 · 내려받기용).
 * 캔버스는 정확히 size×size 이고, 모듈은 정수 픽셀이라 흐려지지 않는다 (남는 픽셀은 여백으로).
 * @param {string} text
 * @param {{size?: number, margin?: number, ecc?: 'L'|'M'|'Q'|'H', color?: string, background?: string}} [opts]
 * @returns {Promise<string>} data:image/png;base64,…
 */
export async function qrDataUrl(text, { size = 512, margin = 2, ecc = 'M', color = '#1d1d1f', background = '#ffffff' } = {}) {
  const m = await qrMatrix(text, ecc);
  const n = m.length;
  const q = Math.max(0, Math.floor(Number(margin) || 0));
  const total = n + q * 2;
  const cell = Math.max(1, Math.floor((Number(size) || 512) / total));
  const px = Math.max(cell * total, Math.floor(Number(size) || 0));
  const offset = Math.floor((px - cell * n) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = color;
  for (let r = 0; r < n; r++) {
    const row = m[r];
    let c = 0;
    while (c < n) {
      if (!row[c]) { c++; continue; }
      const start = c;
      while (c < n && row[c]) c++;
      ctx.fillRect(offset + start * cell, offset + r * cell, (c - start) * cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
}

// ───────────────────────── 사진에서 QR 읽기 ─────────────────────────

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(qrError('image', '사진을 읽지 못했어요.')); };
    img.src = url;
  });
}

function sourceSize(src) {
  return {
    w: src.videoWidth || src.naturalWidth || src.width || 0,
    h: src.videoHeight || src.naturalHeight || src.height || 0,
  };
}

/**
 * 사진 한 장(File/Blob, <img>, <canvas>, <video>, ImageBitmap, ImageData)에서 QR 을 읽는다.
 * 카메라를 못 쓰는 환경(HTTP 접속 등)에서 <input type="file" accept="image/*" capture> 대안으로 쓸 수 있다.
 * @param {Blob|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|ImageData} source
 * @param {{native?: boolean}} [opts]  native=false 면 BarcodeDetector 를 쓰지 않고 jsQR 만 쓴다
 * @returns {Promise<string|null>} 읽은 글자 (없으면 null)
 */
export async function decodeQr(source, { native = true } = {}) {
  if (!source) return null;
  let src = source;
  if (typeof Blob !== 'undefined' && source instanceof Blob) src = await loadImageFromBlob(source);

  if (native && !(typeof ImageData !== 'undefined' && src instanceof ImageData)) {
    const detector = await getNativeDetector();
    if (detector) {
      try {
        const found = await detector.detect(src);
        const hit = found && found.find((b) => b && b.rawValue);
        if (hit) return hit.rawValue;
      } catch { /* jsQR 로 다시 시도 */ }
    }
  }

  const jsQR = await loadJsQR();
  let imageData;
  if (typeof ImageData !== 'undefined' && src instanceof ImageData) {
    imageData = src;
  } else {
    const { w, h } = sourceSize(src);
    if (!w || !h) return null;
    const scale = Math.min(1, 1024 / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, cw, ch);
    imageData = ctx.getImageData(0, 0, cw, ch);
  }
  const res = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  return res && res.data ? res.data : null;
}

// ───────────────────────── 카메라 스캐너 ─────────────────────────

const STYLE_ID = 'qr-scanner-styles';
// 앱 CSS 가 같은 선택자로 덮어쓸 수 있도록 <head> 맨 앞에 넣는다
const SCANNER_CSS = `
.qr-scanner{position:relative;width:100%;height:100%;min-height:200px;overflow:hidden;background:#000;border-radius:inherit;isolation:isolate;-webkit-user-select:none;user-select:none}
.qr-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000}
.qr-video.qr-mirror{transform:scaleX(-1)}
.qr-viewfinder{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center}
.qr-frame{position:relative;width:62%;aspect-ratio:1/1;border-radius:22px;box-shadow:0 0 0 100vmax rgba(0,0,0,.22)}
.qr-corner{position:absolute;width:22%;height:22%;border:0 solid #fff;box-sizing:border-box;filter:drop-shadow(0 1px 3px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(0,0,0,.3))}
.qr-corner-tl{top:0;left:0;border-top-width:5px;border-left-width:5px;border-top-left-radius:22px}
.qr-corner-tr{top:0;right:0;border-top-width:5px;border-right-width:5px;border-top-right-radius:22px}
.qr-corner-bl{bottom:0;left:0;border-bottom-width:5px;border-left-width:5px;border-bottom-left-radius:22px}
.qr-corner-br{bottom:0;right:0;border-bottom-width:5px;border-right-width:5px;border-bottom-right-radius:22px}
.qr-found .qr-frame{animation:qr-found .45s ease}
@keyframes qr-found{0%{transform:scale(1)}35%{transform:scale(.92)}100%{transform:scale(1)}}
.qr-message{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:8px 14px;border-radius:999px;background:rgba(29,29,31,.72);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;font:500 14px/1.4 var(--font,system-ui,sans-serif);text-align:center;pointer-events:none;opacity:0;transition:opacity .2s ease}
.qr-message.qr-show{opacity:1}
.qr-has-error .qr-viewfinder{opacity:0}
.qr-has-error .qr-message{top:50%;bottom:auto;transform:translate(-50%,-50%);border-radius:16px;padding:14px 18px;max-width:min(360px,calc(100% - 32px));font-size:15px;word-break:keep-all}
@media (prefers-reduced-motion:reduce){.qr-found .qr-frame{animation:none}.qr-message{transition:none}}
`;

function ensureScannerStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SCANNER_CSS;
  document.head.insertBefore(style, document.head.firstChild);
}

function isSecure() {
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  const { protocol, hostname } = window.location;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function cameraError(e) {
  const name = (e && e.name) || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return qrError('denied', '카메라 사용이 허용되지 않았어요. 주소창 옆(아이패드는 설정 › Safari › 카메라)에서 카메라를 “허용”으로 바꾼 뒤 다시 시도해 주세요.', e);
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return qrError('notfound', '카메라를 찾을 수 없어요. 카메라가 있는 기기인지, 연결되어 있는지 확인해 주세요.', e);
  }
  if (name === 'NotSupportedError' || name === 'TypeError') {
    return qrError('unsupported', '이 브라우저에서는 카메라를 쓸 수 없어요. Safari나 Chrome 최신 버전으로 열어 주세요.', e);
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return qrError('busy', '카메라를 켤 수 없어요. 다른 앱이나 탭에서 카메라를 쓰고 있다면 닫고 다시 시도해 주세요.', e);
  }
  return qrError('camera', '카메라를 켜는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', e);
}

/**
 * 카메라로 QR 을 읽는 스캐너를 만든다. container 안에 <video> 와 뷰파인더를 넣는다.
 * container 에 높이(또는 aspect-ratio)를 주면 그 크기를 꽉 채운다.
 *
 * @param {HTMLElement} container
 * @param {{
 *   onResult?: (text: string) => void,   같은 코드는 한 번만 — debounceMs 이상 안 보였다가 다시 보이거나 start()를 다시 하면 또 호출
 *   onError?: (err: Error & {code: string}) => void,
 *            code: 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'camera' | 'load'
 *   facingMode?: 'user' | 'environment',  기본 'user'(전면 · 거울처럼 보임)
 *   fps?: number,                         초당 인식 시도 (기본 7)
 *   debounceMs?: number,                  같은 코드를 다시 알리기까지 (기본 2500ms)
 *   showMessages?: boolean,               스캐너 안에 안내/오류 문구 표시 (기본 true)
 *   native?: boolean,                     BarcodeDetector 사용 여부 (기본 true, 없으면 자동으로 jsQR)
 * }} [options]
 * @returns {{ start(): Promise<boolean>, stop(): void, switchCamera(): Promise<boolean>, destroy(): void,
 *            readonly running: boolean, readonly facingMode: string, readonly decoder: string|null,
 *            readonly element: HTMLElement, readonly video: HTMLVideoElement }}
 */
export function createScanner(container, options = {}) {
  const {
    onResult,
    onError,
    fps = 7,
    debounceMs = 2500,
    showMessages = true,
    native = true,
  } = options;
  let facing = options.facingMode === 'environment' ? 'environment' : 'user';

  ensureScannerStyles();

  const root = document.createElement('div');
  root.className = 'qr-scanner';
  const video = document.createElement('video');
  video.className = 'qr-video';
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('aria-label', 'QR 카메라 화면');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  const viewfinder = document.createElement('div');
  viewfinder.className = 'qr-viewfinder';
  viewfinder.setAttribute('aria-hidden', 'true');
  const frame = document.createElement('div');
  frame.className = 'qr-frame';
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    const corner = document.createElement('div');
    corner.className = `qr-corner qr-corner-${pos}`;
    frame.appendChild(corner);
  }
  viewfinder.appendChild(frame);

  const message = document.createElement('div');
  message.className = 'qr-message';
  message.setAttribute('role', 'status');

  root.append(video, viewfinder, message);
  container.appendChild(root);

  // 뷰파인더는 짧은 변의 62% 정사각형
  const layout = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    const side = Math.round(Math.min(w, h) * 0.62);
    frame.style.width = `${side}px`;
    frame.style.height = `${side}px`;
    const radius = `${Math.max(10, Math.round(side * 0.09))}px`;
    frame.style.borderRadius = radius;
    frame.querySelector('.qr-corner-tl').style.borderTopLeftRadius = radius;
    frame.querySelector('.qr-corner-tr').style.borderTopRightRadius = radius;
    frame.querySelector('.qr-corner-bl').style.borderBottomLeftRadius = radius;
    frame.querySelector('.qr-corner-br').style.borderBottomRightRadius = radius;
  };
  let resizeObs = null;
  if (typeof ResizeObserver === 'function') {
    resizeObs = new ResizeObserver(layout);
    resizeObs.observe(root);
  } else {
    window.addEventListener('resize', layout);
  }
  layout();

  let stream = null;
  let running = false;
  let destroyed = false;
  let session = 0; // start/stop 경쟁 방지
  let timer = null;
  let tick = 0;
  let decoderKind = null; // 'native' | 'jsqr'
  let detector = null;
  let jsQR = null;
  let canvas = null;
  let ctx = null;
  let lastText = null;
  let lastSeen = 0;
  let wasConnected = false;
  const interval = Math.max(60, Math.round(1000 / Math.max(1, Math.min(30, Number(fps) || 7))));

  function setMessage(text, isError = false) {
    root.classList.toggle('qr-has-error', !!isError);
    if (!showMessages || !text) {
      message.textContent = '';
      message.classList.remove('qr-show');
      return;
    }
    message.textContent = text;
    message.classList.add('qr-show');
  }

  function fail(err) {
    setMessage(err.message, true);
    root.dataset.state = 'error';
    if (typeof onError === 'function') {
      try { onError(err); } catch (e) { console.error(e); }
    }
  }

  function stopTracks() {
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch { /* 무시 */ }
      }
    }
    stream = null;
    try { video.pause(); } catch { /* 무시 */ }
    video.srcObject = null;
  }

  function stop() {
    session++;
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    stopTracks();
    root.classList.remove('qr-is-running');
    if (root.dataset.state !== 'error') root.dataset.state = 'stopped';
  }

  function emit(text) {
    const now = Date.now();
    if (text === lastText && now - lastSeen < debounceMs) {
      lastSeen = now;
      return;
    }
    lastText = text;
    lastSeen = now;
    root.classList.remove('qr-found');
    void root.offsetWidth; // 애니메이션 다시 시작
    root.classList.add('qr-found');
    setTimeout(() => root.classList.remove('qr-found'), 500);
    if (typeof onResult === 'function') {
      try { onResult(text); } catch (e) { console.error(e); }
    }
  }

  async function decodeFrame() {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    if (decoderKind === 'native' && detector) {
      try {
        const found = await detector.detect(video);
        const hit = found && found.find((b) => b && b.rawValue);
        return hit ? hit.rawValue : null;
      } catch {
        // 일부 기기는 실행 중 지원 안 함 오류를 낸다 → jsQR 로 전환
        decoderKind = 'jsqr';
        detector = null;
        root.dataset.decoder = 'jsqr';
      }
    }

    if (!jsQR) jsQR = await loadJsQR();
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    // 번갈아: 전체 화면(폭 320px) / 가운데 정사각형(320px, 뷰파인더 쪽 — 작은 카드도 잘 읽힘)
    let sx = 0, sy = 0, sw = vw, sh = vh, dw, dh;
    if (tick % 2 === 1) {
      const side = Math.min(vw, vh);
      sx = Math.round((vw - side) / 2);
      sy = Math.round((vh - side) / 2);
      sw = sh = side;
      dw = dh = Math.min(320, side);
    } else {
      dw = Math.min(320, vw);
      dh = Math.max(1, Math.round((vh * dw) / vw));
    }
    if (canvas.width !== dw) canvas.width = dw;
    if (canvas.height !== dh) canvas.height = dh;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
    const img = ctx.getImageData(0, 0, dw, dh);
    const res = jsQR(img.data, dw, dh, { inversionAttempts: 'dontInvert' });
    return res && res.data ? res.data : null;
  }

  function schedule(mySession) {
    if (mySession !== session || !running) return;
    timer = setTimeout(() => loop(mySession), interval);
  }

  async function loop(mySession) {
    if (mySession !== session || !running) return;
    // 화면에서 빠지면(라우트 이동 등) 카메라를 스스로 끈다
    if (root.isConnected) wasConnected = true;
    else if (wasConnected) { stop(); return; }

    if (!document.hidden && video.readyState >= 2) {
      tick++;
      try {
        const text = await decodeFrame();
        if (mySession === session && running && text) emit(text);
      } catch (e) {
        if (e && e.code === 'load') {
          stop();
          fail(e);
          return;
        }
      }
    }
    schedule(mySession);
  }

  async function start() {
    if (destroyed) return false;
    if (running) return true;
    const mySession = ++session;
    root.dataset.state = 'starting';
    lastText = null; // 새로 켤 때마다 같은 코드도 다시 한 번 알린다
    lastSeen = 0;

    if (!isSecure()) {
      fail(qrError('insecure', '카메라는 보안 연결에서만 켤 수 있어요. 주소가 https:// 로 시작하는지(또는 localhost인지) 확인해 주세요.'));
      return false;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      fail(qrError('unsupported', '이 브라우저에서는 카메라를 쓸 수 없어요. Safari나 Chrome 최신 버전으로 열어 주세요.'));
      return false;
    }

    setMessage('카메라를 켜는 중…');

    // 디코더 준비는 카메라 권한 요청과 동시에
    const decoderReady = (async () => {
      detector = native ? await getNativeDetector() : null;
      decoderKind = detector ? 'native' : 'jsqr';
      root.dataset.decoder = decoderKind;
      if (decoderKind === 'jsqr' && !jsQR) jsQR = await loadJsQR();
    })();
    decoderReady.catch(() => {}); // 아래에서 처리

    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (e) {
      if (e && (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError')) {
        try {
          s = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (e2) {
          if (mySession === session) fail(cameraError(e2));
          return false;
        }
      } else {
        if (mySession === session) fail(cameraError(e));
        return false;
      }
    }
    if (mySession !== session || destroyed) {
      for (const t of s.getTracks()) t.stop();
      return false;
    }

    stream = s;
    const track = s.getVideoTracks()[0];
    const settings = track && typeof track.getSettings === 'function' ? track.getSettings() : {};
    // 전면 카메라는 거울처럼 (기기가 알려주는 방향 우선, 모르면 요청한 방향)
    video.classList.toggle('qr-mirror', (settings.facingMode || facing) === 'user');
    if (track) {
      track.addEventListener('ended', () => {
        if (stream === s && running) {
          stop();
          fail(qrError('busy', '카메라 연결이 끊겼어요. 다시 시도해 주세요.'));
        }
      });
    }

    video.srcObject = s;
    try {
      await video.play();
    } catch (e) {
      // 자동 재생이 막히면(드묾) 화면을 눌렀을 때 재생
      if (e && e.name === 'NotAllowedError') {
        const resume = () => { video.play().catch(() => {}); root.removeEventListener('click', resume); };
        root.addEventListener('click', resume);
        setMessage('화면을 눌러 카메라를 시작해 주세요.');
      }
    }
    if (mySession !== session) return false;

    try {
      await decoderReady;
    } catch (e) {
      stop();
      fail(e && e.code ? e : qrError('load', 'QR 인식 모듈을 불러오지 못했어요.', e));
      return false;
    }
    if (mySession !== session) return false;

    running = true;
    root.dataset.state = 'running';
    root.classList.add('qr-is-running');
    if (message.textContent === '카메라를 켜는 중…') setMessage('');
    layout();
    schedule(mySession);
    return true;
  }

  async function switchCamera() {
    facing = facing === 'user' ? 'environment' : 'user';
    if (!running) return false;
    stop();
    return start();
  }

  function destroy() {
    stop();
    destroyed = true;
    if (resizeObs) resizeObs.disconnect();
    else window.removeEventListener('resize', layout);
    root.remove();
  }

  return {
    start,
    stop,
    switchCamera,
    destroy,
    get running() { return running; },
    get facingMode() { return facing; },
    get decoder() { return decoderKind; },
    get element() { return root; },
    get video() { return video; },
  };
}
