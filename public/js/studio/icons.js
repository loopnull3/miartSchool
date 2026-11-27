// 미아트스쿨 스튜디오 아이콘 (모두 직접 그린 인라인 SVG, 그림 문자 없음)
// · 화면 단추: SF Symbols 느낌의 단색 선 아이콘 (currentColor)
// · 붓 도구: 작은 일러스트 (단순한 도형 + 그라데이션). class="tc" 부분은 현재 고른 색(--tc)
import { h } from '../ui.js';

const LINE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

function gearPath() {
  const pts = [];
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    for (const [da, r] of [[-0.34, 7.3], [-0.17, 9.5], [0.17, 9.5], [0.34, 7.3]]) pts.push([12 + Math.cos(a + da * w) * r, 12 + Math.sin(a + da * w) * r]);
  }
  return `M${pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L')}Z`;
}

const CHROME = {
  back: '<path d="M14.5 5 7.5 12l7 7"/>',
  undo: '<path d="M8.5 13.5 4 9l4.5-4.5"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/>',
  redo: '<path d="M15.5 13.5 20 9l-4.5-4.5"/><path d="M20 9H10a5.5 5.5 0 0 0 0 11h3"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6M10.5 7.8v5.4M7.8 10.5h5.4"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6M7.8 10.5h5.4"/>',
  layers: '<path d="M12 3.5 20.5 8 12 12.5 3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  settings: `<path d="${gearPath()}"/><circle cx="12" cy="12" r="3"/>`,
  materials: '<path d="M12 6.6C10.2 5.2 7.4 4.6 4 5v13.2c3.4-.4 6.2.2 8 1.6 1.8-1.4 4.6-2 8-1.6V5c-3.4-.4-6.2.2-8 1.6z"/><path d="M12 6.6v13.2"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 11.5A2 2 0 0 0 9.3 20.4h5.4a2 2 0 0 0 2-1.9L17.5 7M9.5 7V4.6h5V7"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><path d="M4 20 20 4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M10.2 9.2v5.6l4.6-2.8z" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  pencil: '<path d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L9 18.4l-4.5 1.1z"/><path d="m14 6.6 3.4 3.4"/>',
  sparkle: '<path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z"/>',
  save: '<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>',
  send: '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  download: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v8.5M8.5 12.8 12 16.3l3.5-3.5"/>',
  move: '<path d="M12 3.5v17M3.5 12h17"/><path d="m9.2 6.3 2.8-2.8 2.8 2.8M9.2 17.7l2.8 2.8 2.8-2.8M6.3 9.2 3.5 12l2.8 2.8M17.7 9.2l2.8 2.8-2.8 2.8"/>',
  fit: '<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  folderPlus: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.8v5M9.5 13.3h5"/>',
  chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  hand: '<path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0V11M10.8 10.5V5.4a1.4 1.4 0 0 1 2.8 0v5.1M13.6 10.6V6.2a1.4 1.4 0 0 1 2.8 0v6"/><path d="M16.4 9.6a1.4 1.4 0 0 1 2.8 0v4.6a6.3 6.3 0 0 1-6.3 6.3h-.6a6 6 0 0 1-4.6-2.2l-3-3.7a1.5 1.5 0 0 1 2.3-1.9L8 14.2"/>',
};

// 흔히 넘겨받는 그림 문자 아이콘을 선 아이콘으로 바꿔 준다 (호출하는 쪽은 icon: 'save' 처럼 이름을 써도 된다)
const EMOJI_TO_ICON = { '\u{1F4C1}': 'folder', '\u{1F4C2}': 'folder', '\u{1F4BE}': 'save', '\u{1F4EE}': 'send', '\u{1F4E4}': 'send', '\u{2709}': 'send', '\u{2705}': 'check', '\u{2714}': 'check', '\u{2B07}': 'download', '\u{1F4E5}': 'download', '\u{270F}': 'pencil', '\u{1F5D1}': 'trash', '\u{21A9}': 'undo' };
export function iconNameFor(v) {
  if (!v) return null;
  if (CHROME[v]) return v;
  return EMOJI_TO_ICON[String(v).replace(/\uFE0F/g, '').trim()] || null;
}

export function icon(name, size = 22) {
  const body = CHROME[name] || '';
  return h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${LINE}>${body}</svg>` });
}

// 화면에 보이는 글자에서 그림 문자 지우기 (호출하는 쪽 제목·안내에 섞여 들어온 것)
const EMOJI_RE = /(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]\uFE0F?(?:\u200D[\p{Extended_Pictographic}]\uFE0F?)*|[\uFE0F\u20E3])/gu;
export function stripEmoji(s) {
  return String(s ?? '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

// ---- 도구 일러스트 (40×40) ----
// 그라데이션 id는 아이콘마다 달라야 하므로 '{u}'를 고유한 값으로 바꿔 쓴다
const grad = (id, stops, dir = 'h') =>
  `<linearGradient id="${id}{u}" x1="0" y1="0" x2="${dir === 'h' ? 1 : 0}" y2="${dir === 'h' ? 0 : 1}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const G = {
  shade: grad('sh', [[0, '#000', 0.2], [0.38, '#fff', 0], [0.72, '#fff', 0.42], [1, '#fff', 0.08]]),
  wood: grad('wd', [[0, '#c27a3c'], [0.55, '#eab676'], [1, '#d08f4c']]),
  metal: grad('mt', [[0, '#8f959e'], [0.5, '#f2f4f6'], [1, '#a3a9b2']]),
  pencil: grad('pc', [[0, '#ec9a0e'], [0.34, '#ffc43a'], [0.67, '#ffd466'], [1, '#ffe7a6']]),
  cone: grad('cn', [[0, '#e3b67c'], [0.6, '#f8dcae'], [1, '#f1cc94']]),
  pink: grad('pk', [[0, '#ff7f97'], [1, '#ffb8c5']]),
  sky: grad('sk', [[0, '#2491ea'], [0.6, '#69bdf8'], [1, '#4aa8f2']]),
  orange: grad('or', [[0, '#ee8500'], [0.6, '#ffbb45'], [1, '#f79a12']]),
  white: grad('wh', [[0, '#dcdce2'], [0.6, '#ffffff'], [1, '#e8e8ee']]),
  lacquer: grad('lq', [[0, '#5f1a12'], [0.55, '#ae3d2c'], [1, '#7a2619']]),
  blueHandle: grad('bh', [[0, '#3f84e0'], [0.55, '#93c0f7'], [1, '#5b98ea']]),
  cloth: grad('cl', [[0, '#fffaf1'], [1, '#ecdcc2']], 'v'),
  skin: grad('sn', [[0, '#ffc59b'], [1, '#ffe3cc']], 'v'),
  glass: grad('gl', [[0, '#cfe3fb'], [0.5, '#ffffff'], [1, '#d6e7fb']]),
  rainbow: grad('rb', [[0, '#ff3b30'], [0.2, '#ff9500'], [0.4, '#ffcc00'], [0.6, '#34c759'], [0.8, '#0a84ff'], [1, '#af52de']], 'v'),
  bucket: grad('bk', [[0, '#b5bcc6'], [0.5, '#f5f7f9'], [1, '#c3c9d1']]),
  rope: grad('rp', [[0, '#c9894a'], [1, '#e8b47a']], 'v'),
};
const defs = (...keys) => `<defs>${keys.map((k) => G[k]).join('')}</defs>`;
const url = (k) => `url(#${{ shade: 'sh', wood: 'wd', metal: 'mt', pencil: 'pc', cone: 'cn', pink: 'pk', sky: 'sk', orange: 'or', white: 'wh', lacquer: 'lq', blueHandle: 'bh', cloth: 'cl', skin: 'sn', glass: 'gl', rainbow: 'rb', bucket: 'bk', rope: 'rp' }[k]}{u})`;

// 곧게 선 도구(촉이 위)를 그린 뒤 비스듬히(촉이 왼쪽 아래) 돌린다
const TILT = 'transform="translate(20 20) rotate(-135) translate(-20 -22)"';
const tilt = (body) => `<g ${TILT}>${body}</g>`;
const shadow = '<ellipse cx="21" cy="36.5" rx="13" ry="2.2" fill="#000" opacity=".07"/>';

function starPath(cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? ri : ro;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function petals(cx, cy, n, d, rx, ry) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n - 90;
    const rad = (a * Math.PI) / 180;
    const x = (cx + Math.cos(rad) * d).toFixed(2);
    const y = (cy + Math.sin(rad) * d).toFixed(2);
    s += `<ellipse class="tc" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})"/>`;
  }
  return s;
}

const TOOLS = {
  pencil:
    defs('pencil', 'cone', 'metal', 'pink') + shadow +
    tilt(
      `<path d="M20 3 14 16h12z" fill="${url('cone')}"/><path d="M20 3l-2.9 6.2h5.8z" class="tc"/>` +
        `<rect x="14" y="16" width="12" height="19" fill="${url('pencil')}"/><path d="M18 16v19M22 16v19" stroke="#000" stroke-opacity=".08" stroke-width=".7"/>` +
        `<rect x="14" y="35" width="12" height="2.8" fill="${url('metal')}"/><path d="M14 37.8h12v1.6a1.6 1.6 0 0 1-1.6 1.6h-8.8a1.6 1.6 0 0 1-1.6-1.6z" fill="${url('pink')}"/>`,
    ),
  crayon:
    defs('shade') + shadow +
    tilt(
      `<path d="M15.5 12 17.6 5Q20 2.6 22.4 5l2.1 7z" class="tc"/><rect x="15" y="12" width="10" height="29" rx="1.8" class="tc"/>` +
        `<rect x="15" y="17" width="10" height="19" fill="#fff" opacity=".92"/><path d="M15 19.6h10M15 33.4h10" class="tcs" stroke-width="1.3"/>` +
        `<path d="M17.5 24.5h5M17.5 28h3.5" stroke="#c7c7cc" stroke-width="1" stroke-linecap="round"/>` +
        `<rect x="15" y="12" width="10" height="29" rx="1.8" fill="${url('shade')}"/>`,
    ),
  pen:
    defs('shade', 'white') + shadow +
    tilt(
      `<rect x="18.4" y="3" width="3.2" height="7.5" rx="1.6" class="tc"/><path d="M16.6 10h6.8l1.6 5H15z" fill="${url('white')}"/>` +
        `<rect x="15" y="15" width="10" height="26" rx="2.6" class="tc"/><rect x="15" y="21" width="10" height="11" fill="#fff" opacity=".92"/>` +
        `<rect x="15" y="15" width="10" height="26" rx="2.6" fill="${url('shade')}"/>`,
    ),
  marker:
    defs('shade', 'white', 'metal') + shadow +
    tilt(
      `<path d="M16.4 4.2 23.6 7.6V11h-7.2z" class="tc"/><rect x="15.4" y="11" width="9.2" height="4" fill="${url('metal')}"/>` +
        `<rect x="13.5" y="15" width="13" height="26" rx="3.6" fill="${url('white')}" stroke="#d1d1d6" stroke-width=".7"/>` +
        `<path d="M13.5 31h13v6.4a3.6 3.6 0 0 1-3.6 3.6h-5.8a3.6 3.6 0 0 1-3.6-3.6z" class="tc"/><path d="M13.5 31h13v6.4a3.6 3.6 0 0 1-3.6 3.6h-5.8a3.6 3.6 0 0 1-3.6-3.6z" fill="${url('shade')}"/>` +
        `<rect x="16" y="19" width="8" height="8" rx="1.5" class="tc" opacity=".25"/>`,
    ),
  watercolor:
    defs('wood', 'metal', 'shade') + shadow +
    tilt(
      `<path d="M20 2.5c3.6 5 4.4 10 3.6 13.5h-7.2c-.8-3.5 0-8.5 3.6-13.5z" class="tc"/><path d="M20 2.5c3.6 5 4.4 10 3.6 13.5h-7.2c-.8-3.5 0-8.5 3.6-13.5z" fill="${url('shade')}"/>` +
        `<rect x="16.2" y="16" width="7.6" height="6" rx="1" fill="${url('metal')}"/><path d="M16.2 18.2h7.6" stroke="#8f959e" stroke-width=".7"/>` +
        `<path d="M16.8 22h6.4L22 40.6q-2 1-4 0z" fill="${url('wood')}"/>`,
    ),
  watercolorWide:
    defs('blueHandle', 'metal', 'shade') + shadow +
    tilt(
      `<path d="M12.5 4.6Q20 1.4 27.5 4.6V14h-15z" class="tc"/><path d="M12.5 4.6Q20 1.4 27.5 4.6V14h-15z" fill="${url('shade')}"/>` +
        `<path d="M15.2 5v8.6M18.6 3.8v9.8M22 3.8v9.8M25 5v8.6" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>` +
        `<rect x="12.5" y="14" width="15" height="7" rx="1" fill="${url('metal')}"/><path d="M12.5 16.6h15M12.5 18.6h15" stroke="#8f959e" stroke-width=".6"/>` +
        `<path d="M15.6 21h8.8L23 40.6q-3 1.1-6 0z" fill="${url('blueHandle')}"/>`,
    ),
  flower:
    '<ellipse cx="21" cy="37" rx="9" ry="1.8" fill="#000" opacity=".07"/>' +
    '<path d="M20 22q-1.6 8 1 15" stroke="#3aa655" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M20.6 31.5q6-6.2 11-3.2-5.2 6.2-11 3.2z" fill="#4cbb62"/><path d="M19.8 27.5q-5.4-4.6-9.8-2 4.6 5 9.8 2z" fill="#5cc46f"/>' +
    petals(20, 14, 5, 5.6, 5.2, 3.6) +
    '<circle cx="20" cy="14" r="3.4" fill="#ffcf3a"/><circle cx="18.8" cy="12.8" r="1.1" fill="#fff" opacity=".7"/>',
  spray:
    defs('shade', 'metal') + shadow +
    `<rect x="10.5" y="14" width="15" height="23" rx="3.6" class="tc"/><path d="M10.5 15.5Q10.5 9.4 18 9.4t7.5 6.1z" fill="${url('metal')}"/>` +
    '<rect x="15" y="5.2" width="6" height="4.6" rx="1.2" fill="#8e8e93"/><rect x="10.5" y="20.5" width="15" height="8.5" fill="#fff" opacity=".9"/>' +
    `<rect x="10.5" y="14" width="15" height="23" rx="3.6" fill="${url('shade')}"/>` +
    '<circle class="tc" cx="27.5" cy="6" r="1.4"/><circle class="tc" cx="31" cy="8.6" r="1.2" opacity=".8"/><circle class="tc" cx="29.2" cy="11.4" r="1" opacity=".7"/><circle class="tc" cx="34" cy="5.2" r="1" opacity=".6"/><circle class="tc" cx="33.8" cy="12" r=".9" opacity=".55"/><circle class="tc" cx="36.4" cy="8.6" r=".8" opacity=".45"/>',
  rainbow:
    defs('rainbow', 'shade', 'white') + shadow +
    tilt(
      `<rect x="18.4" y="3" width="3.2" height="7.5" rx="1.6" fill="#ff3b30"/><path d="M16.6 10h6.8l1.6 5H15z" fill="${url('white')}"/>` +
        `<rect x="15" y="15" width="10" height="26" rx="2.6" fill="${url('rainbow')}"/><rect x="15" y="15" width="10" height="26" rx="2.6" fill="${url('shade')}"/>`,
    ),
  oil:
    defs('lacquer', 'metal') + shadow +
    tilt(
      '<path d="M14 5.2Q20 1 26 5.2V15H14z" fill="#efe5d3"/><path d="M14 5.2Q20 1 26 5.2v5.2q-3 1.6-5.6.1-3-1.5-6.4.6z" class="tc"/>' +
        '<path d="M16.2 6v8.6M19 4.4V15M22 4.4V15M24.4 6v8.6" stroke="#000" stroke-opacity=".09" stroke-width=".8"/><path d="M17 4.6q2-1.2 5 0" stroke="#fff" stroke-opacity=".5" stroke-width="1" fill="none" stroke-linecap="round"/>' +
        `<rect x="14" y="15" width="12" height="7" rx="1" fill="${url('metal')}"/><path d="M14 17.5h12M14 19.5h12" stroke="#8a8f97" stroke-width=".6"/>` +
        `<path d="M16 22h8l-1.2 18.6q-2.8 1.1-5.6 0z" fill="${url('lacquer')}"/>`,
    ),
  smudge:
    defs('skin') +
    '<path d="M3.5 35.5q6-6.5 14.5-3" class="tcs" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".55"/>' +
    tilt(
      `<path d="M14.5 41V11.5Q14.5 3 20 3t5.5 8.5V41z" fill="${url('skin')}" stroke="#eaa982" stroke-width=".7"/><path d="M17 10.6Q17 5.6 20 5.6t3 5V13q-3 1.3-6 0z" fill="#fff4ec" stroke="#eeb28a" stroke-width=".7"/>` +
        '<path d="M15.4 24h9.2M15.4 31h9.2" stroke="#e8a77d" stroke-width=".9" stroke-linecap="round"/><path d="M20.3 4.8q1.7.4 2 3" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round"/>',
    ),
  rag:
    defs('cloth') + shadow +
    `<path d="M6 13.5q7-5.5 14-1t14-1L35 27q-7 6-14.5 1.5T6.5 29z" fill="${url('cloth')}" stroke="#d6c3a3" stroke-width=".9"/>` +
    '<path d="M6.3 19.2q6.7-5 13.9-.5t14.3-1.2M6.4 24.2q6.6-5 13.9-.5t14.4-1.2" stroke="#e36a6a" stroke-width="1.6" fill="none" opacity=".7"/>' +
    '<path d="M13 9.6v22M24.5 13.4v17.4" stroke="#e36a6a" stroke-width="1.2" opacity=".45"/>' +
    '<ellipse class="tc" cx="27" cy="27.2" rx="5.2" ry="2.8" transform="rotate(-18 27 27.2)" opacity=".85"/>',
  fill:
    defs('bucket') + shadow +
    `<g transform="rotate(-28 21 21)"><path d="M11 14h20l-2.5 19q-7.5 3-15 0z" fill="${url('bucket')}" stroke="#a6adb6" stroke-width=".8"/>` +
    '<ellipse cx="21" cy="14" rx="10" ry="3" class="tc"/><path d="M11 14Q10 4 21 4t10 10" fill="none" stroke="#8e8e93" stroke-width="1.6"/></g>' +
    '<path d="M9.6 18.4q-4 6.6-2.8 11.6.9 3.4 2.6.3 1.1-3.2.2-7.6z" class="tc"/><ellipse cx="7.4" cy="34" rx="3.6" ry="1.4" class="tc" opacity=".6"/>',
  stamp:
    defs('wood') + shadow +
    `<circle cx="20" cy="7.6" r="4.6" fill="${url('wood')}"/><rect x="17.3" y="10.8" width="5.4" height="7.4" fill="${url('wood')}"/>` +
    '<rect x="9" y="18" width="22" height="7" rx="2.2" fill="#8b5a2b"/><rect x="9" y="18" width="22" height="2.2" rx="1.1" fill="#fff" opacity=".18"/><rect x="10.4" y="25" width="19.2" height="2.6" rx="1" class="tc"/>' +
    `<path d="${starPath(20, 33.4, 4.6, 2.1)}" class="tc" stroke-linejoin="round"/>`,
  lasso:
    defs('rope') +
    '<ellipse cx="21" cy="15.5" rx="13" ry="9.5" fill="rgba(0,113,227,.1)" stroke="#1d1d1f" stroke-width="2" stroke-dasharray="3.4 2.8" stroke-linecap="round"/>' +
    `<path d="M12.6 22.6q-3.6 5-.6 8.6 3 3.6-2 7.2" fill="none" stroke="${url('rope')}" stroke-width="2.4" stroke-linecap="round"/><circle cx="12.7" cy="22.8" r="2.6" fill="#0071e3"/><circle cx="12" cy="22" r=".9" fill="#fff" opacity=".7"/>`,
  picker:
    defs('glass', 'orange') + shadow +
    tilt(
      `<path d="M19 3h2l1.6 14h-5.2z" fill="${url('glass')}" stroke="#9cb3ce" stroke-width=".7"/><path d="M19.3 4.4h1.4l.9 7.2h-3.2z" class="tc"/>` +
        `<rect x="16" y="17" width="8" height="4" rx="1" fill="#8e8e93"/><rect x="15.5" y="21" width="9" height="20" rx="4.5" fill="${url('orange')}"/>`,
    ),
  eraser:
    defs('pink', 'sky') + shadow +
    tilt(
      `<path d="M16.5 6h7a3 3 0 0 1 3 3v8h-13V9a3 3 0 0 1 3-3z" fill="${url('pink')}"/><path d="M13.5 17h13v18a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z" fill="${url('sky')}"/>` +
        '<path d="M16.6 22v10" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>',
    ),
  hand:
    defs('skin') + '<ellipse cx="21" cy="37" rx="10" ry="1.8" fill="#000" opacity=".07"/>' +
    `<g fill="${url('skin')}" stroke="#e29f74" stroke-width="1" stroke-linejoin="round">` +
    '<rect x="5.6" y="18" width="6" height="14" rx="3" transform="rotate(-38 8.6 25)"/>' +
    '<rect x="11.4" y="7.6" width="6" height="19" rx="3"/><rect x="17.4" y="5" width="6" height="21" rx="3"/><rect x="23.4" y="6.8" width="6" height="19.4" rx="3"/><rect x="29" y="10.8" width="5.4" height="15.4" rx="2.7"/>' +
    '<path d="M11.4 20h23v7.8q0 8.6-9.2 8.6h-4.6q-9.2 0-9.2-8.6z"/></g>' +
    '<path d="M12.6 20.6h20.6" stroke="#ffd9bd" stroke-width="1.6"/><path d="M14.4 9.4v4M20.4 6.8v4M26.4 8.6v4" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".75"/>',
};

let seq = 0;
export function toolIcon(key, size = 34) {
  const u = `-${++seq}`;
  const body = (TOOLS[key] || '').replaceAll('{u}', u);
  return h('span', { class: 't-ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 40 40" width="${size}" height="${size}">${body}</svg>` });
}

// 그리기 방식 고르기용 작은 그림 (수채화 물방울 · 유화 팔레트)
const TECH = {
  watercolor:
    '<defs><linearGradient id="wd{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc8ff"/><stop offset="1" stop-color="#1f7ae0"/></linearGradient></defs>' +
    '<path d="M12 2.8S5.5 10.4 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.4 12 2.8 12 2.8z" fill="url(#wd{u})"/><ellipse cx="9.6" cy="14.4" rx="1.4" ry="2.4" fill="#fff" opacity=".6"/>',
  oil:
    '<defs><linearGradient id="pl{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d9b1"/><stop offset="1" stop-color="#d9ac72"/></linearGradient></defs>' +
    '<path d="M12 3.2C6.6 3.2 2.8 7 2.8 11.6c0 4.8 3.9 8.8 8.9 8.8 1.8 0 2.4-1.1 2.1-2.3-.3-1.2.2-2.3 1.6-2.3h1.9c2.4 0 3.9-1.7 3.9-4.3 0-4.6-4-8.3-9.2-8.3z" fill="url(#pl{u})" stroke="#c4925a" stroke-width=".6"/>' +
    '<circle cx="8" cy="9.6" r="1.7" fill="#ff3b30"/><circle cx="12.2" cy="7.2" r="1.7" fill="#ffcc00"/><circle cx="16.4" cy="9" r="1.7" fill="#0a84ff"/><circle cx="7.6" cy="14.2" r="1.7" fill="#34c759"/>',
};
export function techIcon(key, size = 20) {
  const u = `-${++seq}`;
  return h('span', { class: 'ico tech-ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}">${(TECH[key] || '').replaceAll('{u}', u)}</svg>` });
}


// ---- 서랍 도구 그림 (가로로 누워 오른쪽을 향함, 왼쪽은 화면 밖으로 잘림) ----
// viewBox 0 0 140 H. 화면에는 오른쪽 60~84px 정도만 보인다. class="tc"는 현재 색.
const V = (id, stops) => `<linearGradient id="${id}{u}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const DG = {
  gl: V('gl', [[0, '#fff', 0.55], [0.36, '#fff', 0.06], [0.62, '#000', 0], [1, '#000', 0.22]]),
  mt: V('mt', [[0, '#8e949c'], [0.32, '#f4f5f7'], [0.7, '#b9bec6'], [1, '#868c95']]),
  wd: V('wd', [[0, '#f7dcaf'], [0.45, '#efc68c'], [1, '#c98b4e']]),
  dk: V('dk', [[0, '#5a5a60'], [0.3, '#3a3a3e'], [1, '#161618']]),
  bw: V('bw', [[0, '#a36c38'], [0.4, '#8b5a2b'], [1, '#5e3a17']]),
  cr: V('cr', [[0, '#fffaf0'], [1, '#e7d9bf']]),
  wh: V('wh', [[0, '#ffffff'], [0.6, '#f2f2f5'], [1, '#d6d6dc']]),
  or: V('or', [[0, '#ffc561'], [0.55, '#ff9f0a'], [1, '#e07f00']]),
  sk: V('sk', [[0, '#8fd2ff'], [0.55, '#45acf5'], [1, '#1f86e0']]),
  mn: V('mn', [[0, '#d2f5da'], [1, '#64c37e']]),
  pb: V('pb', [[0, '#e0eeff'], [1, '#86b4ee']]),
  iv: V('iv', [[0, '#fffdf8'], [0.6, '#f3ece0'], [1, '#d9cdb8']]),
  gs: V('gs', [[0, '#f1f7ff'], [0.5, '#ffffff'], [1, '#cfe0f5']]),
  pk: V('pk', [[0, '#ffffff'], [1, '#ffd9e0']]),
  rb: V('rb', [[0, '#ff3b30'], [0.2, '#ff9500'], [0.4, '#ffcc00'], [0.6, '#34c759'], [0.8, '#0a84ff'], [1, '#af52de']]),
};
const dd = (...k) => `<defs>${k.map((x) => DG[x]).join('')}</defs>`;
const du = (k) => `url(#${k}{u})`;
const f1 = (n) => +n.toFixed(1);

function oilBrush(i) {
  const b = [4, 5.4, 7, 9, 11.5, 14][i];
  const H = Math.ceil(2 * b + 14);
  const cy = H / 2;
  const th = 4 + b * 0.7;
  const L = 24 + b * 1.6;
  const x1 = 90 + L * 0.6;
  const xe = 90 + L;
  const xp = 90 + L * 0.4;
  let lines = '';
  for (let k = 1; k < 4; k++) {
    const y = f1(cy - b + (2 * b * k) / 4);
    lines += `M92 ${y}H${f1(xp + 2)}`;
  }
  const body =
    dd('dk', 'mt', 'cr', 'gl') +
    `<path d="M-2 ${f1(cy - th / 2)}L70 ${f1(cy - th / 2 - 0.6)}V${f1(cy + th / 2 + 0.6)}L-2 ${f1(cy + th / 2)}Z" fill="${du('dk')}"/>` +
    `<path d="M2 ${f1(cy - th / 2 + 1)}H66" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>` +
    `<rect x="70" y="${f1(cy - b - 1)}" width="20" height="${f1(2 * b + 2)}" rx="1.5" fill="${du('mt')}"/><path d="M74 ${f1(cy - b - 1)}V${f1(cy + b + 1)}M77 ${f1(cy - b - 1)}V${f1(cy + b + 1)}" stroke="#7d838c" stroke-width=".7"/>` +
    `<path d="M90 ${f1(cy - b)}L${f1(x1)} ${f1(cy - b)}Q${f1(xe)} ${f1(cy - b)} ${f1(xe)} ${f1(cy)}Q${f1(xe)} ${f1(cy + b)} ${f1(x1)} ${f1(cy + b)}L90 ${f1(cy + b)}Z" fill="${du('cr')}"/>` +
    `<path d="${lines}" stroke="#000" stroke-opacity=".08" stroke-width=".7"/>` +
    `<path class="tc" d="M${f1(xp)} ${f1(cy - b)}L${f1(x1)} ${f1(cy - b)}Q${f1(xe)} ${f1(cy - b)} ${f1(xe)} ${f1(cy)}Q${f1(xe)} ${f1(cy + b)} ${f1(x1)} ${f1(cy + b)}L${f1(xp)} ${f1(cy + b)}Q${f1(xp + 4)} ${f1(cy + b / 2)} ${f1(xp - 1)} ${f1(cy)}Q${f1(xp + 4)} ${f1(cy - b / 2)} ${f1(xp)} ${f1(cy - b)}Z"/>` +
    `<path d="M${f1(xp)} ${f1(cy - b)}L${f1(x1)} ${f1(cy - b)}Q${f1(xe)} ${f1(cy - b)} ${f1(xe)} ${f1(cy)}Q${f1(xe)} ${f1(cy + b)} ${f1(x1)} ${f1(cy + b)}L${f1(xp)} ${f1(cy + b)}Z" fill="${du('gl')}"/>`;
  return { h: H, body };
}

const DRAWER = {
  pencil: {
    h: 24,
    body:
      dd('wd') +
      '<rect x="-2" y="4" width="100" height="16" class="tc"/><rect x="-2" y="4" width="100" height="5" fill="#fff" opacity=".28"/><rect x="-2" y="15" width="100" height="5" fill="#000" opacity=".13"/>' +
      `<path d="M96 4Q100 6 97.2 8.7 100.6 12 97.2 15.3 100 18 96 20L134 12Z" fill="${du('wd')}"/>` +
      '<path class="tc" d="M122 9.5 134 12 122 14.5Z"/><path d="M122 9.5 134 12 122 14.5Z" fill="#000" opacity=".18"/>',
  },
  crayon: {
    h: 30,
    body:
      dd('gl') +
      '<rect x="-2" y="5" width="104" height="20" rx="3" class="tc"/><rect x="34" y="5" width="56" height="20" fill="#fff" opacity=".95"/>' +
      '<rect x="38" y="5" width="2.4" height="20" class="tc"/><rect x="42.8" y="5" width="2.4" height="20" class="tc"/><rect x="79" y="5" width="2.4" height="20" class="tc"/><rect x="83.8" y="5" width="2.4" height="20" class="tc"/>' +
      '<path d="M52 12.5h20M52 17.5h14" stroke="#c7c7cc" stroke-width="1.4" stroke-linecap="round"/>' +
      `<rect x="-2" y="5" width="104" height="20" rx="3" fill="${du('gl')}"/>` +
      '<path class="tc" d="M102 6.5 118 8.5Q131 11 134 15 131 19 118 21.5L102 23.5Z"/><path d="M102 6.5 118 8.5Q131 11 134 15 131 19 118 21.5L102 23.5Z" fill="#000" opacity=".1"/><path d="M106 9.6 121 11.4" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"/>',
  },
  pen: {
    h: 22,
    body:
      dd('gl', 'wh') +
      '<rect x="-2" y="3" width="92" height="16" rx="3" class="tc"/><rect x="40" y="3" width="34" height="16" fill="#fff" opacity=".92"/><rect x="84" y="3" width="6" height="16" fill="#000" opacity=".16"/>' +
      `<rect x="-2" y="3" width="92" height="16" rx="3" fill="${du('gl')}"/>` +
      `<path d="M90 4.5 114 8.6V13.4L90 17.5Z" fill="${du('wh')}"/>` +
      '<path class="tc" d="M113 8.8 128 9.6Q132 11 128 12.4L113 13.2Z"/>',
  },
  marker: {
    h: 28,
    body:
      dd('gl', 'wh', 'mt') +
      `<rect x="-2" y="2" width="90" height="24" rx="5" fill="${du('wh')}" stroke="#d1d1d6" stroke-width=".7"/>` +
      `<path class="tc" d="M60 2H83A5 5 0 0 1 88 7V21A5 5 0 0 1 83 26H60Z"/><path d="M60 2H83A5 5 0 0 1 88 7V21A5 5 0 0 1 83 26H60Z" fill="${du('gl')}"/>` +
      '<rect x="18" y="9" width="30" height="10" rx="2" class="tc" opacity=".22"/>' +
      `<rect x="88" y="6" width="10" height="16" rx="1.5" fill="${du('mt')}"/>` +
      '<path class="tc" d="M98 7.5 122 9 128 20.5H98Z"/><path d="M100 10 120 11.2" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/>',
  },
  watercolor: {
    h: 22,
    body:
      dd('iv', 'mt', 'gl') +
      `<path d="M-2 7 72 6V16L-2 15Z" fill="${du('iv')}"/>` +
      `<rect x="72" y="5" width="20" height="12" rx="2" fill="${du('mt')}"/><path d="M76 5V17M79 5V17" stroke="#7d838c" stroke-width=".7"/>` +
      '<path class="tc" d="M92 4.8C106 4.2 122 7 136 11 122 15 106 17.8 92 17.2Z"/>' +
      `<path d="M92 4.8C106 4.2 122 7 136 11 122 15 106 17.8 92 17.2Z" fill="${du('gl')}"/>`,
  },
  watercolorWide: {
    h: 32,
    body:
      dd('pb', 'mt', 'gl') +
      `<path d="M-2 11.5 66 10.5V21.5L-2 20.5Z" fill="${du('pb')}"/>` +
      `<path d="M66 7 88 3V29L66 25Z" fill="${du('mt')}"/><path d="M71 6V26M75 5.2V26.8" stroke="#7d838c" stroke-width=".7"/>` +
      '<path class="tc" d="M88 3H118Q128 3.5 130 9V23Q128 28.5 118 29H88Z"/>' +
      `<path d="M88 3H118Q128 3.5 130 9V23Q128 28.5 118 29H88Z" fill="${du('gl')}"/>` +
      '<path d="M92 8.5H124M92 13H127M92 17.5H127M92 22H124" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>',
  },
  flower: {
    h: 32,
    body:
      dd('mn', 'mt') +
      `<path d="M-2 12.5 74 11.5V20.5L-2 19.5Z" fill="${du('mn')}"/>` +
      `<rect x="74" y="10.5" width="14" height="11" rx="1.5" fill="${du('mt')}"/>` +
      '<path class="tc" d="M88 10.4C98 10 105 12.5 111 16 105 19.5 98 22 88 21.6Z"/>' +
      '<path d="M112 24Q118 30 126 28 120 22 112 24Z" fill="#4cbb62"/>' +
      [0, 1, 2, 3, 4].map((k) => {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const x = f1(124 + Math.cos(a) * 5.6);
        const y = f1(15 + Math.sin(a) * 5.6);
        return `<ellipse class="tc" cx="${x}" cy="${y}" rx="5" ry="3.6" transform="rotate(${f1((a * 180) / Math.PI)} ${x} ${y})"/>`;
      }).join('') +
      '<circle cx="124" cy="15" r="3.4" fill="#ffcf3a"/><circle cx="122.8" cy="13.8" r="1.1" fill="#fff" opacity=".75"/>',
  },
  spray: {
    h: 38,
    body:
      dd('gl', 'mt') +
      '<rect x="-2" y="5" width="94" height="28" rx="7" class="tc"/><rect x="34" y="5" width="36" height="28" fill="#fff" opacity=".9"/><path d="M42 15h20M42 21h14" class="tcs" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
      `<rect x="-2" y="5" width="94" height="28" rx="7" fill="${du('gl')}"/>` +
      `<path d="M92 7Q104 9 104 19 104 29 92 31Z" fill="${du('mt')}"/>` +
      '<rect x="104" y="14" width="10" height="10" rx="2" fill="#8e8e93"/><circle cx="114" cy="19" r="1.4" fill="#3a3a3c"/>' +
      [[120, 17, 1.7, 0.85], [125, 21, 1.4, 0.7], [124, 13.5, 1.2, 0.6], [130, 18, 1.4, 0.55], [131, 24, 1.1, 0.45], [135, 14.5, 1, 0.4], [137, 21, 0.9, 0.35], [128, 10.5, 1, 0.4]]
        .map(([x, y, r, o]) => `<circle class="tc" cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join(''),
  },
  rainbow: {
    h: 22,
    body:
      dd('gl', 'wh', 'rb') +
      ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#af52de'].map((c, k) => `<rect x="${f1(-2 + k * 15.34)}" y="3" width="15.6" height="16" fill="${c}"/>`).join('') +
      `<rect x="-2" y="3" width="92" height="16" fill="${du('gl')}"/>` +
      `<path d="M90 4.5 114 8.6V13.4L90 17.5Z" fill="${du('wh')}"/>` +
      `<path d="M113 8.8 128 9.6Q132 11 128 12.4L113 13.2Z" fill="${du('rb')}"/>`,
  },
  fill: {
    h: 42,
    body:
      dd('mt') +
      '<path d="M48 9Q72-5 96 7" stroke="#8e8e93" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      `<path d="M36 9 104 4V38L36 33Z" fill="${du('mt')}"/><path d="M52 7.8V34.2M88 5.2V36.8" stroke="#000" stroke-opacity=".08"/>` +
      '<ellipse cx="104" cy="21" rx="5" ry="17" fill="#c7ccd3" stroke="#9aa0a8" stroke-width=".8"/><ellipse class="tc" cx="104.6" cy="21" rx="3.6" ry="14.5"/>' +
      '<path class="tc" d="M106 27C116 28 120 33 124 37 127 40 133 40 138 38.5V41.5C130 42.5 120 42 110 37 106 35 104 31 106 27Z"/>' +
      '<path d="M110 30C116 31.5 119 34 121.5 37" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
  },
  stamp: {
    h: 40,
    body:
      dd('wd', 'bw') +
      `<circle cx="34" cy="20" r="11" fill="${du('wd')}"/><rect x="42" y="14" width="24" height="12" fill="${du('wd')}"/>` +
      `<rect x="66" y="4" width="36" height="32" rx="5" fill="${du('bw')}"/><rect x="68" y="6" width="32" height="5" rx="2.5" fill="#fff" opacity=".16"/>` +
      '<rect x="102" y="6" width="7" height="28" rx="1.5" class="tc"/>' +
      `<path class="tc" d="${starPath(126, 20, 8.4, 3.8)}" opacity=".9"/>`,
  },
  lasso: {
    h: 46,
    body:
      '<path d="M-2 36C20 30 40 42 62 36S86 30 92 33" stroke="#c9bba3" stroke-width="4.2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="110" cy="22" rx="24" ry="17" stroke="#c9bba3" stroke-width="4.2" fill="none"/>' +
      '<path d="M-2 36C20 30 40 42 62 36S86 30 92 33" stroke="#9c8b70" stroke-width="4.2" fill="none" stroke-dasharray="2.4 3" opacity=".55"/>' +
      '<ellipse cx="110" cy="22" rx="24" ry="17" stroke="#9c8b70" stroke-width="4.2" fill="none" stroke-dasharray="2.4 3" opacity=".55"/>' +
      '<ellipse cx="110" cy="22" rx="24" ry="17" stroke="#fff" stroke-width="1" fill="none" stroke-dasharray="2.4 3" stroke-dashoffset="1.4" opacity=".5"/>' +
      '<ellipse cx="91" cy="33" rx="5.6" ry="4.4" fill="#b3a385"/><path d="M88 31.5 94 34.5" stroke="#8a7a60" stroke-width="1"/>',
  },
  picker: {
    h: 24,
    body:
      dd('or', 'gl', 'gs', 'mt') +
      `<rect x="-2" y="2" width="58" height="20" rx="10" fill="${du('or')}"/><rect x="-2" y="2" width="58" height="20" rx="10" fill="${du('gl')}"/>` +
      `<rect x="56" y="5" width="12" height="14" rx="2" fill="${du('mt')}"/>` +
      `<path d="M68 6.5 118 9 134 12 118 15 68 17.5Z" fill="${du('gs')}" stroke="#9cb3ce" stroke-width=".7"/>` +
      '<path class="tc" d="M100 9.9 118 10.6 130.5 12 118 13.4 100 14.1Z"/>',
  },
  eraser: {
    h: 32,
    body:
      dd('sk', 'pk', 'gl') +
      `<rect x="-2" y="3" width="96" height="26" rx="3" fill="${du('sk')}"/><rect x="30" y="3" width="32" height="26" fill="#fff" opacity=".85"/><path d="M36 12.5h20M36 19h13" stroke="#45acf5" stroke-width="1.6" stroke-linecap="round"/>` +
      `<rect x="-2" y="3" width="96" height="26" rx="3" fill="${du('gl')}" opacity=".7"/>` +
      `<rect x="92" y="4" width="36" height="24" rx="4" fill="${du('pk')}" stroke="#e6d3d8" stroke-width=".8"/><path d="M96 8H122" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>`,
  },
  smudge: {
    h: 50,
    body:
      dd('dk', 'mt', 'cr') +
      `<path d="M-2 21 74 20.4V29.6L-2 29Z" fill="${du('dk')}"/><path d="M2 22H70" stroke="#fff" stroke-opacity=".28"/>` +
      `<path d="M74 19 92 18V32L74 31Z" fill="${du('mt')}"/>` +
      `<path d="M92 21 128 3A48 48 0 0 1 128 47L92 29Z" fill="${du('cr')}"/>` +
      [-0.5, -0.33, -0.17, 0, 0.17, 0.33, 0.5].map((t) => `<path d="M93 25L${f1(92 + Math.cos(t) * 44)} ${f1(25 + Math.sin(t) * 44)}" stroke="#000" stroke-opacity=".07" stroke-width=".8"/>`).join('') +
      '<path d="M128 3A48 48 0 0 1 128 47" class="tcs" stroke-width="5" fill="none" opacity=".35"/>',
  },
  rag: {
    h: 42,
    body:
      `<defs>${V('cl', [[0, '#fffaf1'], [1, '#ebdcc2']])}</defs>` +
      '<path d="M26 10Q50 2 72 9T116 7Q130 6 134 14L136 30Q128 38 112 34T70 36 30 33Q22 22 26 10Z" fill="url(#cl{u})" stroke="#d6c3a3" stroke-width=".9"/>' +
      '<path d="M30 17Q52 10 74 16T118 14Q128 13 134 19M28 25Q50 18 72 24T116 22Q128 21 135 26" stroke="#e36a6a" stroke-width="1.6" fill="none" opacity=".6"/>' +
      '<path d="M60 7V34M96 6V35" stroke="#e36a6a" stroke-width="1.2" opacity=".35"/>' +
      '<ellipse class="tc" cx="114" cy="25" rx="11" ry="5" transform="rotate(-10 114 25)" opacity=".85"/><ellipse class="tc" cx="96" cy="13" rx="5" ry="3" opacity=".55"/>',
  },
};
for (let i = 0; i < 6; i++) DRAWER[`oil:${i + 1}`] = oilBrush(i);

// 서랍에 들어갈 도구 그림 (svg 요소 문자열과 높이)
export function drawerArt(key) {
  const d = DRAWER[key];
  if (!d) return { h: 30, svg: '' };
  const u = `-d${++seq}`;
  return { h: d.h, svg: `<svg class="dt-art" viewBox="0 0 140 ${d.h}" width="140" height="${d.h}" aria-hidden="true">${d.body.replaceAll('{u}', u)}</svg>` };
}

// 미아트스쿨 앱 마크
export function brandMark(size = 30) {
  const u = `-b${++seq}`;
  return h('span', {
    class: 'brand-mark',
    'aria-hidden': 'true',
    html:
      `<svg viewBox="0 0 512 512" width="${size}" height="${size}"><defs><linearGradient id="bm${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8cff"/><stop offset="1" stop-color="#5e5ce6"/></linearGradient></defs>` +
      `<rect width="512" height="512" rx="114" fill="url(#bm${u})"/><path d="M256 96c-98 0-174 66-174 150 0 77 61 126 126 126 27 0 36-14 36-30 0-22-19-31-19-50 0-21 17-34 41-34h40c66 0 120-40 120-97 0-40-66-65-170-65z" fill="#fff"/>` +
      '<circle cx="176" cy="226" r="25" fill="#ff6b4a"/><circle cx="232" cy="166" r="25" fill="#ffcc00"/><circle cx="312" cy="166" r="25" fill="#34c759"/><circle cx="366" cy="222" r="21" fill="#0a84ff"/>' +
      '<path d="M330 300l92 92c12 12 12 30 0 42s-30 12-42 0l-92-92z" fill="#ffcc00"/><path d="M288 342l42-42 20 20-42 42z" fill="#fff"/></svg>',
  });
}
