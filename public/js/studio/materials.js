// 수업 자료 시트: 수업 안내(guide)와 자료(유튜브 · 이미지 · 링크)
import { h } from '../ui.js';
import { icon } from './icons.js';

// 유튜브 주소에서 영상 ID와 시작 시각을 뽑는다 (watch?v= · youtu.be/ · shorts/ · embed/ · live/)
export function parseYouTube(url) {
  let u;
  try {
    u = new URL(String(url || '').trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const t = u.searchParams.get('t') || u.searchParams.get('start');
  let start = 0;
  if (t) {
    if (/^\d+$/.test(t)) start = Number(t);
    else {
      const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      if (m) start = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
    }
  }
  return { id, start };
}

export function youTubeEmbedUrl(url) {
  const y = parseYouTube(url);
  if (!y) return null;
  return `https://www.youtube-nocookie.com/embed/${y.id}?rel=0&playsinline=1${y.start ? `&start=${y.start}` : ''}`;
}

// http(s) 주소와 같은 사이트의 경로만 허용 (javascript: 등 차단)
function safeUrl(url, { allowDataImage = false } = {}) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
  try {
    const u = new URL(s, location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch {
    /* 무시 */
  }
  return null;
}

export function normalizeMaterials(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && typeof m === 'object' && m.url)
    .map((m) => {
      const type = m.type === 'youtube' || m.type === 'image' || m.type === 'link' ? m.type : parseYouTube(m.url) ? 'youtube' : 'link';
      return { type, title: String(m.title || '').slice(0, 120), url: String(m.url) };
    });
}

export function hasLessonContent(guide, materials) {
  const g = guide && (guide.title || guide.description || (Array.isArray(guide.steps) && guide.steps.some(Boolean)));
  return Boolean(g || normalizeMaterials(materials).length);
}

function materialCard(m) {
  if (m.type === 'youtube') {
    const src = youTubeEmbedUrl(m.url);
    if (src) {
      return h('figure', { class: 'mat-card mat-video' },
        h('div', { class: 'mat-frame' },
          h('iframe', {
            src,
            title: m.title || '수업 영상',
            loading: 'lazy',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            allowfullscreen: true,
            referrerpolicy: 'strict-origin-when-cross-origin',
          }),
        ),
        h('figcaption', null, icon('play', 18), h('span', null, m.title || '수업 영상')),
      );
    }
  }
  if (m.type === 'image') {
    const src = safeUrl(m.url, { allowDataImage: true });
    if (src) {
      return h('figure', { class: 'mat-card mat-image' },
        h('img', { src, alt: m.title || '참고 이미지', loading: 'lazy', decoding: 'async' }),
        m.title ? h('figcaption', null, icon('photo', 18), h('span', null, m.title)) : null,
      );
    }
  }
  const href = safeUrl(m.url);
  if (!href) return null;
  let hostLabel = '';
  try {
    hostLabel = new URL(href).hostname.replace(/^www\./, '');
  } catch {
    /* 무시 */
  }
  return h('a', { class: 'mat-card mat-link', href, target: '_blank', rel: 'noopener noreferrer' },
    h('span', { class: 'mat-link-ico' }, icon('link', 20)),
    h('span', { class: 'mat-link-text' }, h('strong', null, m.title || hostLabel || '자료 열기'), hostLabel ? h('small', null, hostLabel) : null),
    h('span', { class: 'mat-link-go' }, icon('external', 18)),
  );
}

export function buildMaterialsBody(guide, materials) {
  const body = h('div', { class: 'sheet-body' });
  const steps = Array.isArray(guide?.steps) ? guide.steps.filter((s) => String(s || '').trim()) : [];
  if (guide && (guide.title || guide.description || steps.length)) {
    body.append(
      h('section', { class: 'guide-card' },
        h('div', { class: 'guide-eyebrow' }, icon('sparkle', 16), '오늘의 수업'),
        guide.title ? h('h3', null, guide.title) : null,
        guide.description ? h('p', { class: 'guide-desc' }, guide.description) : null,
        steps.length ? h('ol', { class: 'guide-steps' }, steps.map((s, i) => h('li', null, h('span', { class: 'step-num' }, String(i + 1)), h('span', null, s)))) : null,
      ),
    );
  }
  const list = normalizeMaterials(materials);
  if (list.length) {
    body.append(h('h4', { class: 'sheet-sub' }, '참고 자료'));
    const wrap = h('div', { class: 'mat-list' });
    for (const m of list) {
      const card = materialCard(m);
      if (card) wrap.append(card);
    }
    body.append(wrap);
  }
  return body;
}
