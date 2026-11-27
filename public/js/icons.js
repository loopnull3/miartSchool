// 미아트스쿨 아이콘 세트 (이모지 대신 쓰는 자체 SVG)
// - appIcon: 그라디언트 둥근 사각형 + 흰 그림 (사이드바 · 바로가기)
// - glyph:   선 아이콘 (버튼 · 글자 옆), currentColor
// - weatherIcon / moodIcon / animalIcon / fruitIcon: 색이 있는 일러스트
// - avatarEl: 이름 첫 글자 아바타 (Apple 연락처 스타일)

const G = {
  home: '<path d="M4 11.2 12 4.8l8 6.4"/><path d="M6.4 9.8v8.7h11.2V9.8"/><path d="M10 18.5v-4.6h4v4.6"/>',
  pencil: '<path d="M15.6 4.6l3.8 3.8L8.9 18.9 4.6 19.4l.5-4.3z"/><path d="M13.4 6.8l3.8 3.8"/>',
  folder: '<path d="M3.6 7.6c0-.9.7-1.6 1.6-1.6h3.9l2 2h7.7c.9 0 1.6.7 1.6 1.6v7.8c0 .9-.7 1.6-1.6 1.6H5.2c-.9 0-1.6-.7-1.6-1.6z"/><path d="M3.6 10.2h16.8"/>',
  frame: '<rect x="3.6" y="5" width="16.8" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.7"/><path d="M4.2 17.4l4.9-4.6 3.7 3.4 2.9-2.6 4.1 3.8"/>',
  palette: '<path d="M12 4.2a7.8 7.8 0 0 0 0 15.6c1.1 0 1.6-.7 1.6-1.5 0-1.1-.9-1.3-.9-2.3 0-1 .8-1.6 1.9-1.6h1.8c2.3 0 3.4-1.6 3.4-3.5C19.8 7 16.3 4.2 12 4.2z"/><circle cx="8.2" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.6" cy="7.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>',
  crayon: '<path d="M6 18 15.5 8.5l2.4-3.4 1 1-3.4 2.4L6 18z"/><path d="M4.5 19.5 6 18l-.6 1.9z"/><path d="M13.6 10.4l1.6 1.6"/><path d="M4 21h8"/>',
  school: '<path d="M3.4 9.6 12 5.2l8.6 4.4L12 14z"/><path d="M7 11.6v4.2c0 1.3 2.2 2.6 5 2.6s5-1.3 5-2.6v-4.2"/><path d="M20.6 9.6v4.6"/>',
  book: '<path d="M4.6 5.6H9.8a2.2 2.2 0 0 1 2.2 2.2v11.4a1.6 1.6 0 0 0-1.6-1.6H4.6z"/><path d="M19.4 5.6h-5.2A2.2 2.2 0 0 0 12 7.8v11.4a1.6 1.6 0 0 1 1.6-1.6h5.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.6v2.3M12 18.1v2.3M3.6 12h2.3M18.1 12h2.3M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M6.1 17.9l1.6-1.6M16.3 7.7l1.6-1.6"/>',
  sunCloud: '<circle cx="9" cy="8.6" r="2.8"/><path d="M9 3.4v1.2M3.8 8.6H5M5.3 4.9l.9.9M12.7 4.9l-.9.9"/><path d="M9.2 19h8.1a3 3 0 0 0 .3-6 4.1 4.1 0 0 0-7.7.9A2.6 2.6 0 0 0 9.2 19z"/>',
  heart: '<path d="M12 19.2s-7.2-4.4-7.2-9.6A3.9 3.9 0 0 1 12 7.4a3.9 3.9 0 0 1 7.2 2.2c0 5.2-7.2 9.6-7.2 9.6z"/>',
  camera: '<path d="M4 8.6C4 7.7 4.7 7 5.6 7h2.3l1.5-2.1h5.2L16.1 7h2.3c.9 0 1.6.7 1.6 1.6v8.8c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6z"/><circle cx="12" cy="12.9" r="3.4"/>',
  sparkles: '<path d="M10.6 4.2l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3-4.3-1.5 4.3-1.5z"/><path d="M17.6 14.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  brush: '<path d="M19.8 4.2c-1.9.4-6.9 4.9-8.4 6.9l1.5 1.5c2-1.5 6.5-6.5 6.9-8.4z"/><path d="M10.4 12.6c-2 0-3.4 1.4-3.4 3.4 0 1-.9 1.9-2.5 1.9 4 1.6 7.4.1 7.4-3.4z"/>',
  print: '<path d="M7 9V4.6h10V9"/><rect x="3.8" y="9" width="16.4" height="7.4" rx="1.6"/><path d="M7 13.8h10v5.6H7z"/>',
  send: '<path d="M20.2 3.8 3.6 10.9l6.6 2.6 2.6 6.7z"/><path d="m10.2 13.5 10-9.7"/>',
  search: '<circle cx="10.8" cy="10.8" r="6"/><path d="m20 20-4.8-4.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  left: '<path d="M14.6 5.4 8 12l6.6 6.6"/>',
  right: '<path d="M9.4 5.4 16 12l-6.6 6.6"/>',
  download: '<path d="M12 4.5v10.5M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15.5V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 19.5h14"/>',
  trash: '<path d="M5 7h14M9.5 7V4.8h5V7"/><path d="M6.8 7l.9 12.2h8.6L17.2 7"/><path d="M10.4 10.5v5.6M13.6 10.5v5.6"/>',
  user: '<circle cx="12" cy="8.6" r="3.6"/><path d="M5 19.4c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/>',
  people: '<circle cx="9" cy="9" r="3.2"/><path d="M3.6 18.6c.7-3.2 2.8-4.8 5.4-4.8s4.7 1.6 5.4 4.8"/><circle cx="16.6" cy="8.4" r="2.6"/><path d="M15.4 13.5c2.6-.3 4.6 1.2 5.1 4.4"/>',
  qr: '<rect x="4" y="4" width="6.2" height="6.2" rx="1.2"/><rect x="13.8" y="4" width="6.2" height="6.2" rx="1.2"/><rect x="4" y="13.8" width="6.2" height="6.2" rx="1.2"/><path d="M13.8 13.8h2.6v2.6M20 13.8v.1M13.8 20h.1M16.4 18.4V20H20v-3.4"/>',
  hash: '<path d="M9.5 4.5 8 19.5M16 4.5l-1.5 15M5 9h14.5M4.5 15h14.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 2"/>',
  calendar: '<rect x="4" y="5.6" width="16" height="14" rx="2.2"/><path d="M4 10h16M8.4 3.6v3.8M15.6 3.6v3.8"/>',
  link: '<path d="M10 14a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1"/><path d="M14 10a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1"/>',
  video: '<rect x="3.8" y="6.4" width="12" height="11.2" rx="2"/><path d="m15.8 10.4 4.4-2.6v8.4l-4.4-2.6z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2.2"/><circle cx="9" cy="9.8" r="1.5"/><path d="m4.6 17.2 4.6-4.4 3.6 3.2 2.6-2.4 4 3.6"/>',
  star: '<path d="m12 4.6 2.3 4.7 5.1.7-3.7 3.6.9 5.1L12 16.3l-4.6 2.4.9-5.1L4.6 10l5.1-.7z"/>',
  snow: '<path d="M12 3.6v16.8M4.7 7.8l14.6 8.4M4.7 16.2l14.6-8.4"/><path d="m9.8 4.8 2.2 2 2.2-2M9.8 19.2l2.2-2 2.2 2"/>',
  tree: '<path d="M12 3.8 6.6 10.6h2.8L5.6 15.8h12.8l-3.8-5.2h2.8z"/><path d="M12 15.8v4.4"/>',
  paw: '<ellipse cx="12" cy="15.4" rx="3.8" ry="3.2"/><circle cx="7.2" cy="10.6" r="1.7"/><circle cx="10.2" cy="7.4" r="1.7"/><circle cx="13.8" cy="7.4" r="1.7"/><circle cx="16.8" cy="10.6" r="1.7"/>',
  rocket: '<path d="M12 3.6c3 2 4.4 5.6 4 9.8H8c-.4-4.2 1-7.8 4-9.8z"/><circle cx="12" cy="9.4" r="1.6"/><path d="M8 13.4 5.6 16v2.4L8.4 17M16 13.4l2.4 2.6v2.4L15.6 17M10.4 17.2 12 20.4l1.6-3.2"/>',
  trophy: '<path d="M8 4.6h8v4.6a4 4 0 0 1-8 0z"/><path d="M8 6.6H5.2c0 2.6 1.2 4 3.2 4.2M16 6.6h2.8c0 2.6-1.2 4-3.2 4.2"/><path d="M12 13.2v3.4M8.6 19.6h6.8l-.8-3H9.4z"/>',
  bulb: '<path d="M9.4 15.6c-1.9-1.2-3-3.1-3-5.2a5.6 5.6 0 0 1 11.2 0c0 2.1-1.1 4-3 5.2v1.6H9.4z"/><path d="M9.8 20h4.4"/>',
  rainbow: '<path d="M3.6 17.4a8.4 8.4 0 0 1 16.8 0"/><path d="M6.6 17.4a5.4 5.4 0 0 1 10.8 0"/><path d="M9.6 17.4a2.4 2.4 0 0 1 4.8 0"/>',
  flower: '<circle cx="12" cy="6.4" r="2.3"/><circle cx="15.5" cy="9" r="2.3"/><circle cx="14.2" cy="12.9" r="2.3"/><circle cx="9.8" cy="12.9" r="2.3"/><circle cx="8.5" cy="9" r="2.3"/><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none"/><path d="M12 15.4v5.2"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  logout: '<path d="M14 5H6.6A1.6 1.6 0 0 0 5 6.6v10.8A1.6 1.6 0 0 0 6.6 19H14"/><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>',
  play: '<path d="M8 5.6v12.8l10.4-6.4z" fill="currentColor"/>',
  pause: '<rect x="6.8" y="5.4" width="3.6" height="13.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.6" y="5.4" width="3.6" height="13.2" rx="1.1" fill="currentColor" stroke="none"/>',
  water: '<path d="M12 4.2c3.2 4 5 6.8 5 9.2a5 5 0 0 1-10 0c0-2.4 1.8-5.2 5-9.2z"/>',
  oil: '<path d="M19.8 4.2c-1.9.4-6.9 4.9-8.4 6.9l1.5 1.5c2-1.5 6.5-6.5 6.9-8.4z"/><path d="M10.4 12.6c-2 0-3.4 1.4-3.4 3.4 0 1-.9 1.9-2.5 1.9 4 1.6 7.4.1 7.4-3.4z"/>',
  wave: '<path d="M3.6 12c2.2-2.4 4.2-2.4 6.2 0s4.2 2.4 6.2 0 3-2.2 4.4-1.2"/>',
};

const APP = {
  home: ['#5ac8fa', '#0071e3'],
  assignments: ['#ffcc4d', '#ff8a00'],
  works: ['#64d2ff', '#0a84ff'],
  gallery: ['#e08bff', '#8e44ec'],
  templates: ['#7ee08a', '#28b14c'],
  classes: ['#7d7aff', '#4b48d9'],
  lessons: ['#ff8a7a', '#ff3b30'],
  admin: ['#b8b8c0', '#6e6e78'],
  checkin: ['#7fd3ff', '#2d9cff'],
  psych: ['#ff8ab3', '#ff2d6f'],
  camera: ['#6fe0d6', '#00a39a'],
  ai: ['#c59bff', '#7c4dff'],
  draw: ['#6aa8ff', '#3b5bfd'],
  print: ['#b8b8c0', '#6e6e78'],
  cards: ['#ffcc4d', '#ff9f0a'],
  submitted: ['#7ee08a', '#28b14c'],
  closed: ['#a6b6c8', '#5f7389'],
  open: ['#ffcc4d', '#ff8a00'],
  draft: ['#c59bff', '#7c4dff'],
  board: ['#e08bff', '#8e44ec'],
};
const APP_GLYPH = {
  home: 'home', assignments: 'pencil', works: 'folder', gallery: 'frame', templates: 'crayon', classes: 'school', lessons: 'book',
  admin: 'gear', checkin: 'sunCloud', psych: 'heart', camera: 'camera', ai: 'sparkles', draw: 'brush', print: 'print', cards: 'qr',
  submitted: 'send', closed: 'clock', open: 'palette', draft: 'pencil', board: 'frame',
};

let uid = 0;
const wrap = (svg, cls) => {
  const span = document.createElement('span');
  span.className = `mi-icon ${cls || ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svg;
  return span;
};

export function glyphSvg(name, size = 20, stroke = 1.8) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${G[name] || ''}</svg>`;
}

export function glyph(name, size = 20, stroke = 1.8) {
  return wrap(glyphSvg(name, size, stroke), 'mi-glyph');
}

export function appIconSvg(name, size = 40) {
  const [a, b] = APP[name] || APP.home;
  const g = G[APP_GLYPH[name] || name] || '';
  const id = `mi${++uid}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="12.5" fill="url(#${id}a)"/>
    <rect x="2" y="2" width="44" height="44" rx="12.5" fill="url(#${id}b)"/>
    <g transform="translate(10 10) scale(1.1667)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff">${g}</g>
  </svg>`;
}

export function appIcon(name, size = 40) {
  return wrap(appIconSvg(name, size), 'mi-app');
}

// ---------- 날씨 ----------
const W = {
  sun: (cx, cy, r, id) => `
    <g stroke="#ffb000" stroke-width="3" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `<line x1="${(cx + Math.cos(a) * (r + 4)).toFixed(1)}" y1="${(cy + Math.sin(a) * (r + 4)).toFixed(1)}" x2="${(cx + Math.cos(a) * (r + 8)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r + 8)).toFixed(1)}"/>`;
    }).join('')}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>`,
  cloud: (x, y, s, fill) => `<path transform="translate(${x} ${y}) scale(${s})" d="M10 30h24a8 8 0 0 0 .8-16A11 11 0 0 0 14 13a8.5 8.5 0 0 0-4 17z" fill="${fill}"/>`,
};

export function weatherSvg(key, size = 40) {
  const id = `wx${++uid}`;
  const defs = `<defs>
    <radialGradient id="${id}s" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#ffb000"/></radialGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe7f2"/></linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d1dc"/><stop offset="1" stop-color="#9aa6b6"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a94a8"/><stop offset="1" stop-color="#5d6678"/></linearGradient>
  </defs>`;
  const shadow = 'style="filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.12))"';
  let body = '';
  switch (key) {
    case 'sunny':
      body = W.sun(24, 24, 10, id);
      break;
    case 'partly':
      body = `${W.sun(17, 16, 8, id)}<g ${shadow}>${W.cloud(6, 12, 0.9, `url(#${id}c)`)}</g>`;
      break;
    case 'cloudy':
      body = `<g ${shadow}>${W.cloud(14, 2, 0.75, `url(#${id}g)`)}${W.cloud(2, 12, 1, `url(#${id}c)`)}</g>`;
      break;
    case 'fog':
      body = `<g ${shadow}>${W.cloud(4, 2, 0.95, `url(#${id}g)`)}</g><g stroke="#a4afbf" stroke-width="3" stroke-linecap="round"><line x1="8" y1="36" x2="40" y2="36"/><line x1="12" y1="42" x2="36" y2="42"/></g>`;
      break;
    case 'rain':
      body = `<g ${shadow}>${W.cloud(4, 0, 0.95, `url(#${id}g)`)}</g><g fill="#2d9cff">${[14, 24, 34].map((x, i) => `<path d="M${x} ${34 + (i % 2) * 3}c-2 3-3 4.6-3 6a3 3 0 0 0 6 0c0-1.4-1-3-3-6z"/>`).join('')}</g>`;
      break;
    case 'storm':
      body = `<g ${shadow}>${W.cloud(4, 0, 0.95, `url(#${id}d)`)}</g><path d="M26 28l-7 10h5l-3 8 9-11h-5l3-7z" fill="#ffcc00" stroke="#f0a000" stroke-width="1" stroke-linejoin="round"/>`;
      break;
    default:
      body = '';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">${defs}${body}</svg>`;
}

export function weatherIcon(key, size = 40) {
  return wrap(weatherSvg(key, size), 'mi-weather');
}

// ---------- 기분 얼굴 ----------
const MOODS = {
  great: { mouth: '<path d="M15 27c3 6 15 6 18 0z" fill="#7a3b00"/>', eyes: 'arc' },
  good: { mouth: '<path d="M16 28c3 4 13 4 16 0" stroke="#7a3b00" stroke-width="2.6" fill="none" stroke-linecap="round"/>' },
  soso: { mouth: '<path d="M17 30h14" stroke="#7a3b00" stroke-width="2.6" stroke-linecap="round"/>' },
  sad: { mouth: '<path d="M17 32c3-4 11-4 14 0" stroke="#7a3b00" stroke-width="2.6" fill="none" stroke-linecap="round"/>' },
  verysad: { mouth: '<path d="M16 33c3-5 13-5 16 0" stroke="#7a3b00" stroke-width="2.6" fill="none" stroke-linecap="round"/>', tear: true },
};
export function moodSvg(key, size = 40) {
  const m = MOODS[key] || MOODS.soso;
  const id = `md${++uid}`;
  const eyes =
    m.eyes === 'arc'
      ? '<path d="M15 20c1.5-2.4 4.5-2.4 6 0M27 20c1.5-2.4 4.5-2.4 6 0" stroke="#7a3b00" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="18" cy="20" rx="2.2" ry="2.8" fill="#7a3b00"/><ellipse cx="30" cy="20" rx="2.2" ry="2.8" fill="#7a3b00"/>';
  const tear = m.tear ? '<path d="M14 24c-1.6 2.6-2.4 3.8-2.4 5a2.4 2.4 0 0 0 4.8 0c0-1.2-.8-2.4-2.4-5z" fill="#4fb4ff"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><defs><radialGradient id="${id}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fff0a6"/><stop offset="1" stop-color="#ffc21a"/></radialGradient></defs>
    <circle cx="24" cy="24" r="20" fill="url(#${id})"/><circle cx="13" cy="27" r="3" fill="#ff8a65" opacity=".35"/><circle cx="35" cy="27" r="3" fill="#ff8a65" opacity=".35"/>${eyes}${m.mouth}${tear}</svg>`;
}
export function moodIcon(key, size = 40) {
  return wrap(moodSvg(key, size), 'mi-mood');
}

// ---------- 동물 · 과일 (그림 비밀번호) ----------
const eye = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="4.4" fill="#2b2118"/><circle cx="${x + 1.2}" cy="${y - 1.6}" r="1.3" fill="#fff"/>`;
const cheek = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="2.8" fill="#ff8f8f" opacity=".45"/>`;
const ANIMAL = {
  dog: `<ellipse cx="18" cy="38" rx="11" ry="20" fill="#9b6236" transform="rotate(18 18 38)"/><ellipse cx="78" cy="38" rx="11" ry="20" fill="#9b6236" transform="rotate(-18 78 38)"/>
    <circle cx="48" cy="52" r="30" fill="url(#A1)"/><ellipse cx="48" cy="64" rx="15" ry="12" fill="#fff5e6"/>
    ${eye(37, 48)}${eye(59, 48)}<ellipse cx="48" cy="60" rx="5.6" ry="4.2" fill="#2b2118"/><path d="M48 64v4M42 69c3 3 9 3 12 0" stroke="#2b2118" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M46 70c0 5 4 5 4 0" fill="#ff6f7d"/>${cheek(28, 60)}${cheek(68, 60)}`,
  cat: `<path d="M22 40 26 14l18 16zM74 40 70 14 52 30z" fill="#ffa53b"/><path d="M27 34l2-12 9 9zM69 34l-2-12-9 9z" fill="#ffd2b0"/>
    <circle cx="48" cy="54" r="29" fill="url(#A2)"/><path d="M40 28c2 6 0 10-2 12M48 26v14M56 28c-2 6 0 10 2 12" stroke="#e07b10" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${eye(37, 52)}${eye(59, 52)}<path d="M45 61h6l-3 3z" fill="#ff6f7d"/><path d="M48 64c-2 4-6 4-8 2M48 64c2 4 6 4 8 2" stroke="#2b2118" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M24 60h-12M24 65l-11 3M72 60h12M72 65l11 3" stroke="#b8651a" stroke-width="1.6" stroke-linecap="round"/>${cheek(30, 64)}${cheek(66, 64)}`,
  rabbit: `<ellipse cx="36" cy="22" rx="8" ry="20" fill="url(#A3)"/><ellipse cx="60" cy="22" rx="8" ry="20" fill="url(#A3)"/><ellipse cx="36" cy="22" rx="4" ry="14" fill="#ffc2cc"/><ellipse cx="60" cy="22" rx="4" ry="14" fill="#ffc2cc"/>
    <circle cx="48" cy="58" r="28" fill="url(#A3)"/>${eye(38, 55)}${eye(58, 55)}<path d="M45 63h6l-3 3z" fill="#ff7a8f"/><path d="M48 66c-2 3-5 3-7 1M48 66c2 3 5 3 7 1" stroke="#2b2118" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="45" y="68" width="6" height="5" rx="1" fill="#fff" stroke="#ddd"/>${cheek(30, 66)}${cheek(66, 66)}`,
  pig: `<path d="M24 34 20 16l18 10zM72 34l4-18-18 10z" fill="#ff9fb3"/><circle cx="48" cy="54" r="30" fill="url(#A4)"/>
    ${eye(36, 48)}${eye(60, 48)}<ellipse cx="48" cy="62" rx="12" ry="9" fill="#ff8aa3"/><ellipse cx="44" cy="62" rx="2.4" ry="3.4" fill="#c2455f"/><ellipse cx="52" cy="62" rx="2.4" ry="3.4" fill="#c2455f"/>${cheek(28, 60)}${cheek(68, 60)}`,
  elephant: `<ellipse cx="20" cy="50" rx="16" ry="20" fill="#8fb6e8"/><ellipse cx="76" cy="50" rx="16" ry="20" fill="#8fb6e8"/><ellipse cx="20" cy="50" rx="10" ry="14" fill="#ffc6d4" opacity=".7"/><ellipse cx="76" cy="50" rx="10" ry="14" fill="#ffc6d4" opacity=".7"/>
    <circle cx="48" cy="48" r="26" fill="url(#A5)"/><path d="M44 58c0 10 0 18 8 22 3 1 5-1 4-3-4-3-4-9-4-19z" fill="url(#A5)"/>${eye(38, 44)}${eye(58, 44)}${cheek(32, 56)}${cheek(64, 56)}`,
  panda: `<circle cx="24" cy="28" r="11" fill="#2b2b2e"/><circle cx="72" cy="28" r="11" fill="#2b2b2e"/><circle cx="48" cy="54" r="30" fill="url(#A6)"/>
    <ellipse cx="36" cy="50" rx="8" ry="10" fill="#2b2b2e" transform="rotate(-20 36 50)"/><ellipse cx="60" cy="50" rx="8" ry="10" fill="#2b2b2e" transform="rotate(20 60 50)"/><circle cx="37" cy="49" r="3" fill="#fff"/><circle cx="59" cy="49" r="3" fill="#fff"/>
    <ellipse cx="48" cy="62" rx="5" ry="3.6" fill="#2b2b2e"/><path d="M48 65c-2 3-6 3-8 1M48 65c2 3 6 3 8 1" stroke="#2b2b2e" stroke-width="2" fill="none" stroke-linecap="round"/>${cheek(28, 64)}${cheek(68, 64)}`,
};
const ANIMAL_DEFS = `<defs>
  <radialGradient id="A1" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#f4c58c"/><stop offset="1" stop-color="#d9934f"/></radialGradient>
  <radialGradient id="A2" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff9f2e"/></radialGradient>
  <radialGradient id="A3" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8e6ef"/></radialGradient>
  <radialGradient id="A4" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffd6df"/><stop offset="1" stop-color="#ff9fb3"/></radialGradient>
  <radialGradient id="A5" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#cfe2ff"/><stop offset="1" stop-color="#8fb6e8"/></radialGradient>
  <radialGradient id="A6" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e4ea"/></radialGradient>
</defs>`;

const FRUIT = {
  apple: `<path d="M48 30c-6-6-24-6-26 12-2 16 10 34 18 34 4 0 5-2 8-2s4 2 8 2c8 0 20-18 18-34-2-18-20-18-26-12z" fill="url(#F1)"/><path d="M48 30c0-8 2-12 6-16" stroke="#7a4a1e" stroke-width="3.6" stroke-linecap="round" fill="none"/><path d="M52 22c6-8 16-6 18-4-6 6-12 6-18 4z" fill="#3fbf5f"/><ellipse cx="34" cy="44" rx="5" ry="8" fill="#fff" opacity=".35" transform="rotate(20 34 44)"/>`,
  banana: `<path d="M22 30c-2 26 16 46 48 44 6 0 6-6 0-8-24-2-36-16-38-36-1-6-9-6-10 0z" fill="url(#F2)"/><path d="M24 26c-1-4 6-6 8-2z" fill="#6b4a1a"/><path d="M68 72c3 1 6-1 4-4" stroke="#6b4a1a" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M30 36c2 16 12 28 30 32" stroke="#fff" stroke-width="3" opacity=".35" fill="none" stroke-linecap="round"/>`,
  grape: `${[[36, 34], [50, 34], [64, 34], [43, 47], [57, 47], [36, 60], [50, 60], [64, 60], [43, 73], [57, 73], [50, 85]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.6" fill="url(#F3)"/><circle cx="${x - 2.6}" cy="${y - 2.6}" r="2.2" fill="#fff" opacity=".45"/>`).join('')}<path d="M50 26c0-8 4-12 8-14" stroke="#6b4a1a" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M52 18c8-8 20-4 22 0-8 6-16 6-22 0z" fill="#3fbf5f"/>`,
  orange: `<circle cx="48" cy="54" r="30" fill="url(#F4)"/><g fill="#d96a00" opacity=".35">${Array.from({ length: 12 }, (_, i) => `<circle cx="${(48 + Math.cos(i * 0.52) * 18).toFixed(1)}" cy="${(54 + Math.sin(i * 0.52) * 18).toFixed(1)}" r="1.2"/>`).join('')}</g><path d="M48 24c0-4 1-6 3-8" stroke="#6b4a1a" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M51 20c6-6 16-4 18-1-6 5-12 5-18 1z" fill="#3fbf5f"/><ellipse cx="36" cy="42" rx="6" ry="9" fill="#fff" opacity=".35" transform="rotate(30 36 42)"/>`,
  peach: `<path d="M48 26c-18-2-30 12-28 28 2 18 14 26 28 26s26-8 28-26C78 38 66 24 48 26z" fill="url(#F5)"/><path d="M48 28c-6 8-8 20-4 46" stroke="#ff8a8a" stroke-width="2.6" fill="none" opacity=".7"/><path d="M48 26c-2-6-8-10-16-10 2 8 8 12 16 10z" fill="#5cc96d"/><ellipse cx="34" cy="44" rx="5" ry="9" fill="#fff" opacity=".35" transform="rotate(25 34 44)"/>`,
  watermelon: `<path d="M14 40h68a34 34 0 0 1-68 0z" fill="#3fa34d"/><path d="M18 40h60a30 30 0 0 1-60 0z" fill="#e8f7d8"/><path d="M22 40h52a26 26 0 0 1-52 0z" fill="url(#F6)"/>${[[34, 50], [44, 56], [54, 56], [64, 50], [49, 64], [39, 46], [59, 46]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.8" ry="3" fill="#2b2118"/>`).join('')}`,
};
const FRUIT_DEFS = `<defs>
  <radialGradient id="F1" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#d90f1f"/></radialGradient>
  <linearGradient id="F2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#ffc21a"/></linearGradient>
  <radialGradient id="F3" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b388ff"/><stop offset="1" stop-color="#6a2fd6"/></radialGradient>
  <radialGradient id="F4" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffc36b"/><stop offset="1" stop-color="#ff8a00"/></radialGradient>
  <radialGradient id="F5" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd8c2"/><stop offset="1" stop-color="#ff8f84"/></radialGradient>
  <radialGradient id="F6" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#ff3b4f"/></radialGradient>
</defs>`;

export function animalSvg(key, size = 72) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">${ANIMAL_DEFS}${ANIMAL[key] || ''}</svg>`;
}
export function fruitSvg(key, size = 72) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">${FRUIT_DEFS}${FRUIT[key] || ''}</svg>`;
}
export const animalIcon = (key, size) => wrap(animalSvg(key, size), 'mi-pic');
export const fruitIcon = (key, size) => wrap(fruitSvg(key, size), 'mi-pic');

// ---------- 이름 아바타 ----------
const AV = [['#64d2ff', '#0a84ff'], ['#ffb340', '#ff8a00'], ['#7ee08a', '#28b14c'], ['#e08bff', '#8e44ec'], ['#ff8a9a', '#ff375f'], ['#7d7aff', '#4b48d9'], ['#6fe0d6', '#00a39a'], ['#ffd65c', '#f5a700']];
export function avatarColors(seed) {
  const s = String(seed ?? '');
  let hsh = 0;
  for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) >>> 0;
  return AV[hsh % AV.length];
}
export function avatarEl(person, size = 40) {
  const name = person?.name || '?';
  const tone = /^tone(\d)$/.exec(person?.avatar || '');
  const [a, b] = tone ? AV[Number(tone[1]) % AV.length] : avatarColors(person?.id ?? name);
  const el = document.createElement('span');
  el.className = 'mi-avatar';
  el.setAttribute('aria-hidden', 'true');
  const t = name.trim();
  const label = /^[가-힣]{3}$/.test(t) ? t.slice(1) : t.slice(0, 1).toUpperCase() || '?';
  el.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * (label.length > 1 ? 0.34 : 0.44))}px;background:linear-gradient(160deg,${a},${b})`;
  el.textContent = label;
  return el;
}

// 보드 아이콘 (보드별 선택)
export const BOARD_ICONS = ['frame', 'palette', 'rainbow', 'star', 'flower', 'snow', 'tree', 'paw', 'rocket', 'book', 'trophy', 'bulb', 'school'];
export function boardIcon(key, size = 22) {
  return glyph(BOARD_ICONS.includes(key) ? key : 'frame', size);
}

export const ICON_NAMES = Object.keys(G);
