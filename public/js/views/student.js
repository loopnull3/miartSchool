// 학생 화면: 대시보드 · 내 과제 · 내 작품
import { api } from '../api.js';
import { h, clear, fill, modal, emptyState, fmtDate, fmtDateTime, stampEl, confirmDialog, toast, toastError } from '../ui.js';
import { shell, go } from '../app.js';
import { templateThumbSrc } from '../templates.js';
import { openCheckinSheet, weatherBadge } from './checkin.js';

const TECH = { watercolor: '수채화', oil: '유화' };

function period(g) {
  const f = (s) => (s ? fmtDateTime(s) : '');
  if (g.start_at && g.end_at) return `${f(g.start_at)} ~ ${f(g.end_at)}`;
  if (g.end_at) return `${f(g.end_at)}까지`;
  return `${fmtDate(g.created_at)} 시작`;
}

function assignmentHref(g) {
  if (g.submitted_id && !g.draft_id) return `#/draw?artwork=${g.submitted_id}`;
  return g.draft_id ? `#/draw?artwork=${g.draft_id}` : `#/draw?assignment=${g.id}`;
}

function newDrawingSheet() {
  let technique = 'watercolor';
  let orientation = 'landscape';
  const techRow = h('div', { class: 'segmented lg' });
  const oriRow = h('div', { class: 'segmented lg' });
  const render = () => {
    fill(techRow, ...['watercolor', 'oil'].map((k) => h('button', { class: technique === k ? 'on' : '', onclick: () => { technique = k; render(); } }, k === 'oil' ? '🖌️ 유화' : '💧 수채화')));
    fill(oriRow, ...[['landscape', '가로'], ['portrait', '세로']].map(([k, l]) => h('button', { class: orientation === k ? 'on' : '', onclick: () => { orientation = k; render(); } }, l)));
  };
  render();
  modal({
    title: '새 그림 그리기',
    body: h('div', { class: 'stack', style: { gap: '18px' } },
      h('div', null, h('div', { class: 'q-label', style: { marginTop: 0 } }, '어떤 도구로 그릴까요?'), techRow,
        h('p', { class: 'small faint', style: { margin: '8px 0 0' } }, '수채화: 연필·크레용·수채화 붓·꽃 브러시 등  ·  유화: 유화 붓 1~6호·스머지·헝겊')),
      h('div', null, h('div', { class: 'q-label', style: { marginTop: 0 } }, '도화지 방향'), oriRow),
    ),
    actions: [{ label: '취소' }, { label: '그리기 시작', class: 'primary', onClick: () => go(`/draw?technique=${technique}&orientation=${orientation}`) }],
  });
}

export async function dashboard() {
  const [d, ai, ck] = await Promise.all([api.get('/student/home'), api.get('/ai/status'), api.get('/student/checkin')]);
  const s = d.student;
  const fresh = d.assignments.filter((g) => !g.submitted_id && !g.draft_id);
  const doing = d.assignments.filter((g) => !g.submitted_id);
  const checkinBox = h('div');

  const renderCheckin = (entry) => {
    clear(checkinBox);
    if (!ck.enabled) return;
    checkinBox.append(
      h('div', { class: 'card row between', style: { padding: '18px 22px' } },
        h('div', { class: 'row nowrap' },
          h('div', { style: { fontSize: '40px' } }, entry ? weatherBadge(entry.weather).emoji : '🌈'),
          h('div', null,
            h('div', { style: { fontWeight: 700 } }, entry ? `오늘 내 마음은 ${weatherBadge(entry.weather).label}` : '오늘의 마음 날씨는 어때요?'),
            h('div', { class: 'small muted' }, entry ? '바뀌었다면 언제든 다시 고를 수 있어요.' : '날씨로 오늘 기분을 알려 주세요.'),
          ),
        ),
        h('button', { class: `btn ${entry ? '' : 'primary'}`, onclick: () => openCheckinSheet(entry, (e) => { ck.entry = e; renderCheckin(e); }) }, entry ? '다시 고르기' : '체크인하기'),
      ),
    );
  };
  renderCheckin(ck.entry);

  let banner;
  if (fresh.length) {
    const g = fresh[0];
    banner = h('div', { class: 'hero-banner' },
      h('div', null, h('h2', null, '새로운 과제가 열렸어요'), h('p', null, `「${g.title}」 지금 바로 시작해 볼까요?`), h('a', { class: 'btn', href: `#/draw?assignment=${g.id}` }, '과제 바로가기')),
      h('div', { class: 'hb-art' }, g.technique === 'oil' ? '🖌️' : '🎨'),
    );
  } else {
    banner = h('div', { class: 'hero-banner calm' },
      h('div', null, h('h2', null, `${s.name}, 오늘도 멋지게 그려 볼까요?`), h('p', null, '자유롭게 그리거나 도안을 골라 색칠해요.'), h('button', { class: 'btn', onclick: newDrawingSheet }, '새 그림 그리기')),
      h('div', { class: 'hb-art' }, '✏️'),
    );
  }

  const psych = d.psych.filter((p) => !p.done);
  const shortcuts = [
    ['c1', '🖌️', '새 그림', '수채화 · 유화', null, newDrawingSheet],
    ['c3', '🖍️', '도안 색칠', '귀여운 도안 고르기', '#/templates/builtin'],
    ['c5', '📷', '사진으로 도안', '사진이 선화로 바뀌어요', '#/templates/photo'],
    ai.enabled ? ['c6', '✨', 'AI 도안', '말하면 도안이 나와요', '#/templates/ai'] : null,
    d.klass.gallery_enabled ? ['c2', '🖼️', '갤러리보드', '친구들 작품 구경', '#/boards'] : null,
    psych.length ? ['c4', '💗', '그림 마음 탐색', psych[0].title, `#/s/psych/${psych[0].id}`] : null,
  ].filter(Boolean);

  // 오늘 첫 방문이면 체크인 시트 자동으로 열기
  if (ck.enabled && !ck.entry) {
    const key = `miart-checkin-prompt-${s.id}-${ck.today}`;
    let shown = false;
    try {
      shown = !!localStorage.getItem(key);
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    if (!shown) setTimeout(() => openCheckinSheet(null, (e) => { ck.entry = e; renderCheckin(e); }), 400);
  }

  return shell(
    h('div', null,
      h('div', { class: 'row nowrap mb' },
        h('span', { class: 'avatar lg' }, s.avatar),
        h('div', null, h('h1', { style: { margin: 0 } }, `${s.name}, 안녕!`), h('p', { class: 'muted', style: { margin: 0 } }, d.klass.name)),
      ),
      banner,
      h('div', { class: 'mt' }, checkinBox),
      h('div', { class: 'section-title' }, h('h2', null, '진행 중인 과제'), h('a', { href: '#/s/assignments', class: 'chev' }, '전체 보기')),
      doing.length ? h('div', { class: 'assign-grid' }, doing.slice(0, 3).map(assignCard)) : h('p', { class: 'muted' }, '지금은 해야 할 과제가 없어요.'),
      h('div', { class: 'section-title' }, h('h2', null, '바로 가기')),
      h('div', { class: 'grid three' },
        shortcuts.map(([c, e, t, sub, href, fn]) => h(href ? 'a' : 'button', { class: `tile ${c}`, href: href || undefined, onclick: fn || undefined }, h('div', { class: 'tile-emoji' }, e), h('div', { class: 'tile-title' }, t), h('div', { class: 'tile-sub' }, sub))),
      ),
      h('div', { class: 'section-title' }, h('h2', null, '최근 작품'), h('a', { href: '#/s/works', class: 'chev' }, d.newFeedback ? `새 칭찬 ${d.newFeedback}개` : '내 작품')),
      d.recent.length ? h('div', { class: 'grid tight' }, d.recent.map((a) => workTile(a, () => go('/s/works')))) : h('p', { class: 'muted' }, '아직 그린 작품이 없어요. 첫 그림을 그려 볼까요?'),
    ),
    { active: 'home' },
  );
}

function statusOf(g) {
  if (g.not_started) return ['before', '시작 전'];
  if (g.submitted_id) return ['done', '제출 완료'];
  if (g.closed) return ['closed', '마감'];
  if (g.draft_id) return ['draft', '그리는 중'];
  return ['doing', '진행 중'];
}

export function assignCard(g) {
  const thumb = templateThumbSrc(g.template_ref);
  const [cls, label] = statusOf(g);
  const paperCls = g.paper && g.paper !== 'white' && g.paper !== 'watercolor' ? `paper-${g.paper}` : '';
  return h('button', {
    class: 'assign-card',
    onclick: () => {
      if (g.not_started) return toast(`아직 시작 전이에요. ${fmtDateTime(g.start_at)}에 열려요.`);
      location.hash = assignmentHref(g).slice(1);
    },
  },
    h('div', { class: 'assign-preview' },
      h('div', { class: `assign-paper ${g.orientation === 'portrait' ? 'portrait' : ''} ${paperCls}` },
        thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'ap-emoji' }, g.technique === 'oil' ? '🖌️' : '💧'),
        h('span', { class: 'ap-title' }, g.title),
      ),
    ),
    h('div', { class: 'assign-info' },
      h('span', { class: `status-pill ${cls}` }, label),
      h('div', { class: 'ai-title' }, g.title),
      h('div', { class: 'ai-meta' }, h('span', null, TECH[g.technique] || '수채화'), h('span', null, '·'), h('span', null, period(g))),
    ),
  );
}

export async function assignments({ query }) {
  const list = await api.get('/student/assignments');
  let tab = query.tab === 'closed' ? 'closed' : 'open';
  let sort = 'due';
  let q = '';
  const grid = h('div', { class: 'assign-grid' });
  const tabsEl = h('div', { class: 'text-tabs', role: 'tablist' });
  const search = h('input', { class: 'input', type: 'search', placeholder: '과제명 검색', 'aria-label': '과제명 검색', oninput: () => { q = search.value.trim().toLowerCase(); renderGrid(); } });
  const sortSel = h('select', { class: 'input', 'aria-label': '정렬', style: { width: 'auto' }, onchange: () => { sort = sortSel.value; renderGrid(); } },
    h('option', { value: 'due' }, '임박순'), h('option', { value: 'new' }, '최신순'));
  const isClosed = (g) => g.closed && !g.not_started;
  const renderTabs = () => {
    const n = (c) => list.filter((g) => (c ? isClosed(g) : !isClosed(g))).length;
    fill(tabsEl,
      h('button', { class: tab === 'open' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'open'), onclick: () => { tab = 'open'; renderTabs(); renderGrid(); } }, h('span', { class: 'ti' }, '🎨'), `진행중 과제`, h('span', { class: 'badge' }, n(false))),
      h('span', { class: 'sep' }),
      h('button', { class: tab === 'closed' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'closed'), onclick: () => { tab = 'closed'; renderTabs(); renderGrid(); } }, h('span', { class: 'ti' }, '🏞️'), '마감된 과제', h('span', { class: 'badge' }, n(true))),
    );
  };
  const renderGrid = () => {
    let items = list.filter((g) => (tab === 'closed' ? isClosed(g) : !isClosed(g))).filter((g) => !q || g.title.toLowerCase().includes(q));
    const due = (g) => (g.end_at ? Date.parse(g.end_at) : Infinity);
    items = items.sort(sort === 'due' ? (a, b) => (a.not_started - b.not_started) || due(a) - due(b) : (a, b) => (a.created_at < b.created_at ? 1 : -1));
    clear(grid);
    if (!items.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState(tab === 'open' ? '🎉' : '📭', q ? '검색 결과가 없어요' : tab === 'open' ? '지금은 해야 할 과제가 없어요' : '마감된 과제가 없어요')));
    items.forEach((g) => grid.append(assignCard(g)));
  };
  renderTabs();
  renderGrid();
  return shell(
    h('div', null,
      h('h1', { style: { marginBottom: '26px' } }, '과제'),
      h('div', { class: 'toolbar-row' }, tabsEl, h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'search' }, search), sortSel)),
      grid,
    ),
    { active: 'assignments' },
  );
}

function workTile(a, onClick) {
  return h('button', { class: 'art', onclick: onClick },
    h('div', { class: 'art-img' },
      h('img', { src: `/api/artworks/${a.id}/image?thumb=1&v=${encodeURIComponent(a.updated_at)}`, alt: a.title, loading: 'lazy', onerror: (e) => e.target.remove() }),
      h('div', { class: 'corner' },
        a.status === 'draft' ? h('span', { class: 'badge warn' }, '그리는 중') : h('span', { class: 'badge ok' }, '제출'),
        !a.seen_feedback ? h('span', { class: 'count-dot' }, 'N') : null,
      ),
    ),
    h('div', { class: 'art-meta' },
      h('div', { class: 'art-title' }, a.title),
      h('div', { class: 'art-sub' }, a.assignment_title ? `📝 ${a.assignment_title}` : TECH[a.technique] || '자유 그림', a.feedback_count ? h('span', null, `· 🏅 ${a.feedback_count}`) : null),
      h('div', { class: 'art-sub' }, fmtDate(a.updated_at)),
    ),
  );
}

export async function postToBoardSheet(artwork) {
  const boards = (await api.get('/boards')).filter((b) => b.student_posts);
  if (!boards.length) return toast('아직 작품을 올릴 수 있는 갤러리보드가 없어요.');
  let pick = boards[0].id;
  const list = h('div', { class: 'stack', style: { gap: '8px' } });
  const render = () => {
    fill(list, 
      ...boards.map((b) =>
        h('button', { class: `chip ${pick === b.id ? 'on' : ''}`, style: { justifyContent: 'flex-start', minHeight: '46px' }, onclick: () => { pick = b.id; render(); } }, `${b.emoji} ${b.title}`, h('span', { class: 'small', style: { opacity: 0.7, marginLeft: 'auto' } }, b.scope === 'school' ? '우리 학교' : '우리 반')),
      ),
    );
  };
  render();
  const caption = h('input', { class: 'input', maxlength: 40, value: artwork.title, placeholder: '제목' });
  const text = h('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: '작품을 소개해 주세요. (선택)' });
  modal({
    title: '갤러리보드에 올리기',
    body: h('div', { class: 'stack' }, h('img', { src: `/api/artworks/${artwork.id}/image?thumb=1`, alt: '', style: { maxHeight: '180px', margin: '0 auto', borderRadius: '12px' } }), h('div', { class: 'q-label' }, '어느 보드에 올릴까요?'), list, caption, text),
    actions: [
      { label: '취소' },
      { label: '올리기', class: 'primary', onClick: async () => {
        await api.post(`/boards/${pick}/posts`, { artworkId: artwork.id, title: caption.value, body: text.value });
        toast('갤러리보드에 올렸어요 🎉', 'ok');
      } },
    ],
  });
}

export async function works() {
  const list = await api.get('/student/artworks');
  let filter = 'all';
  let q = '';
  const grid = h('div', { class: 'grid tight' });
  const seg = h('div', { class: 'text-tabs', role: 'tablist' });
  const search = h('input', { class: 'input', type: 'search', placeholder: '작품 검색', 'aria-label': '작품 검색', oninput: () => { q = search.value.trim().toLowerCase(); render(); } });
  const render = () => {
    const tabs = [['all', '🗂️', '전체 작품'], ['draft', '✏️', '그리는 중'], ['submitted', '📮', '제출한 작품']];
    fill(seg, tabs.map(([k, e, l], i) => [i ? h('span', { class: 'sep' }) : null, h('button', { class: filter === k ? 'on' : '', role: 'tab', 'aria-selected': String(filter === k), onclick: () => { filter = k; render(); } }, h('span', { class: 'ti' }, e), l)]));
    clear(grid);
    const items = list.filter((a) => (filter === 'all' || a.status === filter) && (!q || a.title.toLowerCase().includes(q) || (a.assignment_title || '').toLowerCase().includes(q)));
    if (!items.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('🎨', '아직 작품이 없어요', '첫 그림을 그려 볼까요?', h('button', { class: 'btn primary', onclick: newDrawingSheet }, '새 그림 그리기'))));
      return;
    }
    for (const a of items) grid.append(workTile(a, () => openWork(a)));
  };

  const openWork = async (a) => {
    const detail = await api.get(`/artworks/${a.id}`);
    if (!a.seen_feedback) {
      api.post(`/student/artworks/${a.id}/seen`).catch(() => {});
      a.seen_feedback = true;
      render();
    }
    const m = modal({
      title: a.title,
      wide: true,
      body: h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1.6fr) minmax(220px, 1fr)', alignItems: 'start' } },
        h('img', { src: `/api/artworks/${a.id}/image?v=${encodeURIComponent(a.updated_at)}`, alt: a.title, style: { width: '100%', borderRadius: '14px', background: '#fff', boxShadow: 'var(--shadow)' } }),
        h('div', { class: 'stack' },
          h('div', { class: 'small muted' }, a.assignment_title ? `📝 ${a.assignment_title}` : TECH[a.technique] || '자유 그림', ' · ', fmtDateTime(a.updated_at)),
          h('h3', { style: { margin: '6px 0 0' } }, '선생님의 칭찬'),
          detail.feedback.length
            ? h('div', { class: 'stack' }, detail.feedback.map((f) => h('div', { class: 'row nowrap' }, f.stamp ? stampEl(f.stamp) : null, f.comment ? h('div', { class: 'card inset', style: { padding: '10px 14px' } }, f.comment) : null)))
            : h('p', { class: 'small faint' }, a.status === 'submitted' ? '선생님이 곧 봐 주실 거예요!' : '아직 선생님께 보내지 않았어요.'),
          h('a', { class: 'btn primary', href: `#/draw?artwork=${a.id}` }, a.status === 'draft' ? '이어 그리기' : '고쳐 그리기'),
          h('button', { class: 'btn', onclick: () => { m.close(); postToBoardSheet(a).catch(toastError); } }, '🖼️ 갤러리보드에 올리기'),
          a.status === 'draft'
            ? h('button', { class: 'btn danger sm', onclick: async () => {
                if (!(await confirmDialog('이 그림을 지울까요?', { okLabel: '지우기', danger: true }))) return;
                await api.del(`/artworks/${a.id}`);
                list.splice(list.indexOf(a), 1);
                m.close();
                render();
                toast('지웠어요');
              } }, '지우기')
            : null,
        ),
      ),
    });
  };
  render();
  return shell(
    h('div', null,
      h('div', { class: 'row between', style: { marginBottom: '26px' } }, h('h1', { style: { margin: 0 } }, '작품'), h('button', { class: 'btn primary', onclick: newDrawingSheet }, '+ 새 그림')),
      h('div', { class: 'toolbar-row' }, seg, h('div', { class: 'search' }, search)),
      grid,
    ),
    { active: 'works' },
  );
}
