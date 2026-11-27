// 스튜디오 아이콘 — 화면 단추는 SF Symbols 느낌의 선 아이콘, 붓 도구는 작은 일러스트 (모두 인라인 SVG)
import { h } from '../ui.js';

const LINE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

function gearPath() {
  const cx = 12;
  const cy = 12;
  const teeth = 8;
  const ro = 9.5;
  const ri = 7.3;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    for (const [da, r] of [[-0.34, ri], [-0.17, ro], [0.17, ro], [0.34, ri]]) {
      pts.push([cx + Math.cos(a + da * w) * r, cy + Math.sin(a + da * w) * r]);
    }
  }
  return `M${pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L')}Z`;
}

const CHROME = {
  back: '<path d="M14.5 5 7.5 12l7 7"/>',
  undo: '<path d="M8.5 13.5 4 9l4.5-4.5"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/>',
  redo: '<path d="M15.5 13.5 20 9l-4.5-4.5"/><path d="M20 9H10a5.5 5.5 0 0 0 0 11h3"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6M10.5 7.8v5.4M7.8 10.5h5.4"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6M7.8 10.5h5.4"/>',
  fit: '<path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
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
};

export function icon(name, size = 22) {
  const body = CHROME[name] || '';
  return h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${LINE}>${body}</svg>` });
}

// ---- 도구 일러스트 (40×40). class="tc" 부분은 현재 색(--tc)으로 칠해진다 ----
// 곧게 선 도구를 그린 뒤 비스듬히(촉이 왼쪽 아래) 돌린다
const TILT = 'transform="translate(20 20) rotate(-135) translate(-20 -22)"';
const tilt = (body) => `<g ${TILT}>${body}</g>`;

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
    s += `<ellipse class="tc" cx="${(cx + Math.cos(rad) * d).toFixed(2)}" cy="${(cy + Math.sin(rad) * d).toFixed(2)}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${(cx + Math.cos(rad) * d).toFixed(2)} ${(cy + Math.sin(rad) * d).toFixed(2)})"/>`;
  }
  return s;
}

const TOOLS = {
  pencil: tilt(
    '<path d="M20 3 14 16h12z" fill="#f3d2a0"/><path d="M20 3l-2.9 6.2h5.8z" class="tc"/>' +
      '<rect x="14" y="16" width="12" height="19" fill="#ffc53d"/><rect x="14" y="16" width="4" height="19" fill="#ef9f12"/><rect x="22" y="16" width="4" height="19" fill="#ffdc80"/>' +
      '<rect x="14" y="35" width="12" height="2.8" fill="#c5cad1"/><path d="M14 37.8h12v1.6a1.6 1.6 0 0 1-1.6 1.6h-8.8a1.6 1.6 0 0 1-1.6-1.6z" fill="#ff8fa3"/>',
  ),
  crayon: tilt(
    '<path d="M15.5 12 17.6 5Q20 2.6 22.4 5l2.1 7z" class="tc"/><rect x="15" y="12" width="10" height="29" rx="1.8" class="tc"/>' +
      '<rect x="15" y="17" width="10" height="19" fill="#fff" opacity=".9"/><path d="M15 19.6h10M15 33.4h10" class="tcs" stroke-width="1.3"/>' +
      '<rect x="22.3" y="12" width="1.6" height="29" fill="#fff" opacity=".35"/><rect x="15" y="12" width="2.2" height="29" fill="#000" opacity=".1"/>',
  ),
  pen: tilt(
    '<rect x="18.4" y="3" width="3.2" height="7.5" rx="1.6" class="tc"/><path d="M16.6 10h6.8l1.6 5H15z" fill="#e3e3e8"/>' +
      '<rect x="15" y="15" width="10" height="26" rx="2.6" class="tc"/><rect x="15" y="21" width="10" height="11" fill="#fff" opacity=".9"/>' +
      '<rect x="22.4" y="15.5" width="1.6" height="25" rx=".8" fill="#fff" opacity=".3"/>',
  ),
  marker: tilt(
    '<path d="M16.4 4.2 23.6 7.6V11h-7.2z" class="tc"/><rect x="15.4" y="11" width="9.2" height="4" fill="#c7c7cc"/>' +
      '<rect x="13.5" y="15" width="13" height="26" rx="3.6" fill="#f5f5f7" stroke="#d1d1d6" stroke-width=".8"/>' +
      '<path d="M13.5 31h13v6.4a3.6 3.6 0 0 1-3.6 3.6h-5.8a3.6 3.6 0 0 1-3.6-3.6z" class="tc"/><rect x="22.6" y="16.5" width="2" height="13.5" rx="1" fill="#fff"/>',
  ),
  watercolor: tilt(
    '<path d="M20 2.5c3.6 5 4.4 10 3.6 13.5h-7.2c-.8-3.5 0-8.5 3.6-13.5z" class="tc"/><path d="M20.4 4.5c1.6 3 2.3 6.4 2.1 9.4" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<rect x="16.2" y="16" width="7.6" height="6" rx="1" fill="#c9ccd3"/><path d="M16.2 18.2h7.6" stroke="#9fa4ac" stroke-width=".8"/>' +
      '<path d="M16.8 22h6.4L22 40.6q-2 1-4 0z" fill="#dc9a55"/><path d="m21.7 22.6-.7 17" stroke="#f2c891" stroke-width="1"/>',
  ),
  watercolorWide: tilt(
    '<path d="M12.5 4.6Q20 1.4 27.5 4.6V14h-15z" class="tc"/><path d="M15 5v8.6M18.4 3.8v9.8M21.8 3.8v9.8M25 5v8.6" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>' +
      '<rect x="12.5" y="14" width="15" height="7" rx="1" fill="#c9ccd3"/><path d="M12.5 16.6h15M12.5 18.6h15" stroke="#9fa4ac" stroke-width=".7"/>' +
      '<path d="M15.6 21h8.8L23 40.6q-3 1.1-6 0z" fill="#74aaf0"/><path d="m22.6 21.6-.8 18.4" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>',
  ),
  flower:
    '<path d="M20 22q-1.6 8 1 16" stroke="#3aa655" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M20.6 31.5q6-6.2 11-3.2-5.2 6.2-11 3.2z" fill="#4cbb62"/><path d="M19.8 27.5q-5.4-4.6-9.8-2 4.6 5 9.8 2z" fill="#5cc46f"/>' +
    petals(20, 14, 5, 5.6, 5.2, 3.6) +
    '<circle cx="20" cy="14" r="3.4" fill="#ffcf3a"/><circle cx="19" cy="13.2" r=".9" fill="#e08a1c"/><circle cx="21.2" cy="14.8" r=".8" fill="#e08a1c"/>',
  spray:
    '<rect x="10.5" y="14" width="15" height="24" rx="3.6" class="tc"/><path d="M10.5 15.5Q10.5 9.4 18 9.4t7.5 6.1z" fill="#c7c7cc"/>' +
    '<rect x="15" y="5.2" width="6" height="4.6" rx="1.2" fill="#8e8e93"/><rect x="10.5" y="21" width="15" height="9" fill="#fff" opacity=".88"/>' +
    '<rect x="22" y="15.5" width="1.8" height="21" rx=".9" fill="#fff" opacity=".35"/>' +
    '<circle class="tc" cx="27.5" cy="6" r="1.4"/><circle class="tc" cx="31" cy="8.6" r="1.2" opacity=".8"/><circle class="tc" cx="29.2" cy="11.4" r="1" opacity=".7"/><circle class="tc" cx="34" cy="5.2" r="1" opacity=".6"/><circle class="tc" cx="33.8" cy="12" r=".9" opacity=".55"/><circle class="tc" cx="36.4" cy="8.6" r=".8" opacity=".45"/>',
  rainbow: tilt(
    '<rect x="18.4" y="3" width="3.2" height="7.5" rx="1.6" fill="#ff3b30"/><path d="M16.6 10h6.8l1.6 5H15z" fill="#e3e3e8"/>' +
      '<rect x="15" y="15" width="10" height="4.4" fill="#ff3b30"/><rect x="15" y="19.3" width="10" height="4.4" fill="#ff9500"/><rect x="15" y="23.6" width="10" height="4.4" fill="#ffcc00"/>' +
      '<rect x="15" y="27.9" width="10" height="4.4" fill="#34c759"/><rect x="15" y="32.2" width="10" height="4.4" fill="#0a84ff"/><path d="M15 36.5h10v2a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 15 38.5z" fill="#af52de"/>' +
      '<rect x="22.4" y="15.5" width="1.6" height="25" rx=".8" fill="#fff" opacity=".35"/>',
  ),
  oil: tilt(
    '<path d="M14 5.2Q20 1 26 5.2V15H14z" fill="#efe5d3"/><path d="M14 5.2Q20 1 26 5.2v5.2q-3 1.6-5.6.1-3-1.5-6.4.6z" class="tc"/>' +
      '<path d="M16.2 6v8.6M19 4.4V15M22 4.4V15M24.4 6v8.6" stroke="#000" stroke-opacity=".09" stroke-width=".8"/>' +
      '<rect x="14" y="15" width="12" height="7" rx="1" fill="#b9bdc4"/><path d="M14 17.5h12M14 19.5h12" stroke="#8a8f97" stroke-width=".7"/>' +
      '<path d="M16 22h8l-1.2 18.6q-2.8 1.1-5.6 0z" fill="#8f3022"/><path d="m22.2 22.6-.7 17.4" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>',
  ),
  smudge:
    '<path d="M3.5 35.5q6-6.5 14.5-3" class="tcs" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".55"/>' +
    tilt(
      '<path d="M14.5 41V11.5Q14.5 3 20 3t5.5 8.5V41z" fill="#ffd3b0"/><path d="M17 10.6Q17 5.6 20 5.6t3 5V13q-3 1.3-6 0z" fill="#fff4ec" stroke="#eeb28a" stroke-width=".8"/>' +
        '<path d="M15.4 24h9.2M15.4 31h9.2" stroke="#e8a77d" stroke-width=".9" stroke-linecap="round"/><rect x="22.6" y="12" width="1.6" height="27" rx=".8" fill="#fff" opacity=".35"/>',
    ),
  rag:
    '<path d="M6 13.5q7-5.5 14-1t14-1L35 27q-7 6-14.5 1.5T6.5 29z" fill="#f7eddd" stroke="#d6c3a3" stroke-width=".9"/>' +
    '<path d="M6.3 19.2q6.7-5 13.9-.5t14.3-1.2M6.4 24.2q6.6-5 13.9-.5t14.4-1.2" stroke="#e36a6a" stroke-width="1.6" fill="none" opacity=".7"/>' +
    '<path d="M13 9.6q0 22 0 22M24.5 13.4v17.4" stroke="#e36a6a" stroke-width="1.2" opacity=".45"/>' +
    '<ellipse class="tc" cx="27" cy="27.2" rx="5.2" ry="2.8" transform="rotate(-18 27 27.2)" opacity=".85"/>',
  fill:
    '<g transform="rotate(-28 21 21)"><path d="M11 14h20l-2.5 19q-7.5 3-15 0z" fill="#e6e9ee" stroke="#a6adb6" stroke-width=".9"/>' +
    '<ellipse cx="21" cy="14" rx="10" ry="3" class="tc"/><path d="M11 14Q10 4 21 4t10 10" fill="none" stroke="#8e8e93" stroke-width="1.6"/>' +
    '<path d="m25.4 16.4 1.6 15" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"/></g>' +
    '<path d="M9.6 18.4q-4 6.6-2.8 11.6.9 3.4 2.6.3 1.1-3.2.2-7.6z" class="tc"/>',
  stamp:
    '<circle cx="20" cy="7.6" r="4.6" fill="#dc9a55"/><rect x="17.3" y="10.8" width="5.4" height="7.4" fill="#c88745"/>' +
    '<rect x="9" y="18" width="22" height="7" rx="2.2" fill="#8b5a2b"/><rect x="10.4" y="25" width="19.2" height="2.6" rx="1" class="tc"/>' +
    `<path d="${starPath(20, 34, 5.2, 2.3)}" class="tc" stroke-linejoin="round"/>`,
  lasso:
    '<ellipse cx="21" cy="15.5" rx="13" ry="9.5" fill="rgba(0,113,227,.1)" stroke="#1d1d1f" stroke-width="2" stroke-dasharray="3.4 2.8" stroke-linecap="round"/>' +
    '<path d="M12.6 22.6q-3.6 5 -.6 8.6 3 3.6-2 7.2" fill="none" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/><circle cx="12.7" cy="22.8" r="2.4" fill="#0071e3"/>',
  picker: tilt(
    '<path d="M19 3h2l1.6 14h-5.2z" fill="#eaf3ff" stroke="#9cb3ce" stroke-width=".8"/><path d="M19.3 4.4h1.4l.9 7.2h-3.2z" class="tc"/>' +
      '<rect x="16" y="17" width="8" height="4" rx="1" fill="#8e8e93"/><rect x="15.5" y="21" width="9" height="20" rx="4.5" fill="#ff9f0a"/>' +
      '<rect x="21.5" y="23" width="1.6" height="14" rx=".8" fill="#fff" opacity=".45"/>',
  ),
  eraser: tilt(
    '<path d="M16.5 6h7a3 3 0 0 1 3 3v8h-13V9a3 3 0 0 1 3-3z" fill="#ff9fb0"/><path d="M13.5 17h13v18a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z" fill="#4fb3f6"/>' +
      '<path d="M16.6 22v10" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><rect x="23" y="7" width="1.8" height="9" rx=".9" fill="#fff" opacity=".4"/>',
  ),
  hand:
    '<g fill="none" stroke="#3a3a3c" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6.5v27M6.5 20h27"/>' +
    '<path d="M16 10.5l4-4 4 4M16 29.5l4 4 4-4M10.5 16l-4 4 4 4M29.5 16l4 4-4 4"/></g>',
};

export function toolIcon(key) {
  const body = TOOLS[key] || '';
  return h('span', { class: 't-ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 40 40" width="34" height="34">${body}</svg>` });
}
