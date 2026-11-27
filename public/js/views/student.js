// 학생 화면: 대시보드 · 내 과제 · 내 작품
import { api } from '../api.js';
import { h, clear, fill, modal, emptyState, fmtDate, fmtDateTime, stampEl, confirmDialog, toast, toastError } from '../ui.js';
import { shell, go } from '../app.js';
import { appIcon, glyph, weatherIcon, avatarEl, boardIcon } from '../icons.js';
import { templateThumbSrc } from '../templates.js';
import { openCheckinSheet, weatherBadge } from './checkin.js';

const TECH = { watercolor: '수채화', oil: '유화' };

function period(g) {
  if (g.not_started && g.start_at) return `${fmtDateTime(g.start_at)}에 열려요`;
  if (g.end_at) return `${fmtDate(g.end_at)}까지`;
  return TECH[g.technique] || '수채화';
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
    fill(techRow, ...['watercolor', 'oil'].map((k) => h('button', { class: technique === k ? 'on' : '', onclick: () => { technique = k; render(); } }, k === 'oil' ? [glyph('oil', 18), ' 유화'] : [glyph('water', 18), ' 수채화'])));
    fill(oriRow, ...[['landscape', '가로'], ['portrait', '세로']].map(([k, l]) => h('button', { class: orientation === k ? 'on' : '', onclick: () => { orientation = k; render(); } }, l)));
  };
  render();
  modal({
    title: '새 그림 그리기',
    body: h('div', { class: 'stack', style: { gap: '18px' } },
      h('div', null, h('div', { class: 'q-label', style: { marginTop: 0 } }, '어떤 도구로 그릴까요?'), techRow),
      h('div', null, h('div', { class: 'q-label', style: { marginTop: 0 } }, '도화지 방향'), oriRow),
    ),
    actions: [{ label: '취소' }, { label: '그리기 시작', class: 'primary', onClick: () => go(`/draw?technique=${technique}&orientation=${orientation}`) }],
  });
}

// 홈: 인사 + 마음 날씨(작게) + 할 일(과제·마음 탐색) + 큰 버튼 두 개
export async function dashboard() {
  const [d, ck] = await Promise.all([api.get('/student/home'), api.get('/student/checkin')]);
  const s = d.student;
  const doing = d.assignments.filter((g) => !g.submitted_id && !g.not_started);
  const psych = d.psych.filter((p) => !p.done);
  const checkinBox = h('div');

  const renderCheckin = (entry) => {
    clear(checkinBox);
    if (!ck.enabled) return;
    checkinBox.append(
      h('button', { class: `checkin-pill ${entry ? '' : 'empty'}`, onclick: () => openCheckinSheet(entry, (e) => { ck.entry = e; renderCheckin(e); }) },
        entry ? weatherIcon(entry.weather, 34) : appIcon('checkin', 30),
        h('span', null, entry ? `오늘 마음 ${weatherBadge(entry.weather).label}` : '오늘 마음 날씨 고르기'),
      ),
    );
  };
  renderCheckin(ck.entry);

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

  const todo = [
    ...doing.slice(0, 3).map(assignCard),
    ...psych.slice(0, 1).map((p) => h('a', { class: 'assign-card psych-card', href: `#/s/psych/${p.id}` },
      h('div', { class: 'assign-preview' }, appIcon('psych', 72)),
      h('div', { class: 'assign-info' }, h('span', { class: 'status-pill doing' }, '마음 탐색'), h('div', { class: 'ai-title' }, p.title), h('div', { class: 'ai-meta' }, '집 · 나무 · 사람 그리기')),
    )),
  ];

  return shell(
    h('div', null,
      h('div', { class: 'row between', style: { marginBottom: '28px' } },
        h('div', { class: 'row nowrap' }, avatarEl(s, 52), h('h1', { style: { margin: 0 } }, `${s.name}, 안녕!`)),
        checkinBox,
      ),
      h('div', { class: 'section-title', style: { marginTop: 0 } }, h('h2', null, '오늘 할 일'), doing.length > 3 ? h('a', { href: '#/s/assignments', class: 'chev' }, '전체 보기') : null),
      todo.length ? h('div', { class: 'assign-grid' }, todo) : h('p', { class: 'muted' }, '지금은 해야 할 과제가 없어요.'),
      h('div', { class: 'big-actions' },
        h('button', { class: 'big-action', onclick: newDrawingSheet }, appIcon('draw', 56), h('b', null, '새 그림')),
        h('a', { class: 'big-action', href: '#/templates/builtin' }, appIcon('templates', 56), h('b', null, '도안 색칠')),
        d.newFeedback ? h('a', { class: 'big-action', href: '#/s/works' }, appIcon('works', 56), h('b', null, `새 칭찬 ${d.newFeedback}개`)) : null,
      ),
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
        thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'ap-emoji' }, glyph(g.technique === 'oil' ? 'oil' : 'water', 44, 1.4)),
        h('span', { class: 'ap-title' }, g.title),
      ),
    ),
    h('div', { class: 'assign-info' },
      h('span', { class: `status-pill ${cls}` }, label),
      h('div', { class: 'ai-title' }, g.title),
      h('div', { class: 'ai-meta' }, period(g)),
    ),
  );
}

export async function assignments({ query }) {
  const list = await api.get('/student/assignments');
  let tab = query.tab === 'closed' ? 'closed' : 'open';
  let sort = 'due';
  let q = '';
  const grid = h('div', { class: 'assign-grid' });
  const tabsEl = h('div', { class: 'segmented lg', role: 'tablist' });
  const search = h('input', { class: 'input', type: 'search', placeholder: '과제명 검색', 'aria-label': '과제명 검색', oninput: () => { q = search.value.trim().toLowerCase(); renderGrid(); } });
  const sortSel = h('select', { class: 'input', 'aria-label': '정렬', style: { width: 'auto' }, onchange: () => { sort = sortSel.value; renderGrid(); } },
    h('option', { value: 'due' }, '임박순'), h('option', { value: 'new' }, '최신순'));
  const isClosed = (g) => g.closed && !g.not_started;
  const renderTabs = () => {
    const n = (c) => list.filter((g) => (c ? isClosed(g) : !isClosed(g))).length;
    fill(tabsEl,
      h('button', { class: tab === 'open' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'open'), onclick: () => { tab = 'open'; renderTabs(); renderGrid(); } }, `진행중 ${n(false)}`),
      h('button', { class: tab === 'closed' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'closed'), onclick: () => { tab = 'closed'; renderTabs(); renderGrid(); } }, `마감 ${n(true)}`),
    );
  };
  const renderGrid = () => {
    let items = list.filter((g) => (tab === 'closed' ? isClosed(g) : !isClosed(g))).filter((g) => !q || g.title.toLowerCase().includes(q));
    const due = (g) => (g.end_at ? Date.parse(g.end_at) : Infinity);
    items = items.sort(sort === 'due' ? (a, b) => (a.not_started - b.not_started) || due(a) - due(b) : (a, b) => (a.created_at < b.created_at ? 1 : -1));
    clear(grid);
    if (!items.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState(tab === 'open' ? 'submitted' : 'closed', q ? '검색 결과가 없어요' : tab === 'open' ? '지금은 해야 할 과제가 없어요' : '마감된 과제가 없어요')));
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
        a.status === 'draft' ? h('span', { class: 'badge warn' }, '그리는 중') : null,
        !a.seen_feedback ? h('span', { class: 'count-dot' }, 'N') : null,
      ),
    ),
    h('div', { class: 'art-meta' },
      h('div', { class: 'art-title' }, a.title),
      h('div', { class: 'art-sub' }, fmtDate(a.updated_at), a.feedback_count ? ` · 칭찬 ${a.feedback_count}` : ''),
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
        h('button', { class: `chip ${pick === b.id ? 'on' : ''}`, style: { justifyContent: 'flex-start', minHeight: '46px' }, onclick: () => { pick = b.id; render(); } }, boardIcon(b.emoji, 18), b.title, h('span', { class: 'small', style: { opacity: 0.7, marginLeft: 'auto' } }, b.scope === 'school' ? '우리 학교' : '우리 반')),
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
        toast('갤러리보드에 올렸어요', 'ok');
      } },
    ],
  });
}

export async function works() {
  const list = await api.get('/student/artworks');
  let filter = 'all';
  let q = '';
  const grid = h('div', { class: 'grid tight' });
  const seg = h('div', { class: 'segmented lg', role: 'tablist' });
  const search = h('input', { class: 'input', type: 'search', placeholder: '작품 검색', 'aria-label': '작품 검색', oninput: () => { q = search.value.trim().toLowerCase(); render(); } });
  const render = () => {
    const tabs = [['all', '전체'], ['draft', '그리는 중'], ['submitted', '제출']];
    fill(seg, tabs.map(([k, l]) => h('button', { class: filter === k ? 'on' : '', role: 'tab', 'aria-selected': String(filter === k), onclick: () => { filter = k; render(); } }, l)));
    clear(grid);
    const items = list.filter((a) => (filter === 'all' || a.status === filter) && (!q || a.title.toLowerCase().includes(q) || (a.assignment_title || '').toLowerCase().includes(q)));
    if (!items.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('works', '아직 작품이 없어요', '첫 그림을 그려 볼까요?', h('button', { class: 'btn primary', onclick: newDrawingSheet }, '새 그림 그리기'))));
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
          h('div', { class: 'small muted' }, a.assignment_title ? `과제 · ${a.assignment_title}` : TECH[a.technique] || '자유 그림', ' · ', fmtDateTime(a.updated_at)),
          h('h3', { style: { margin: '6px 0 0' } }, '선생님의 칭찬'),
          detail.feedback.length
            ? h('div', { class: 'stack' }, detail.feedback.map((f) => h('div', { class: 'row nowrap' }, f.stamp ? stampEl(f.stamp) : null, f.comment ? h('div', { class: 'card inset', style: { padding: '10px 14px' } }, f.comment) : null)))
            : h('p', { class: 'small faint' }, a.status === 'submitted' ? '선생님이 곧 봐 주실 거예요!' : '아직 선생님께 보내지 않았어요.'),
          h('a', { class: 'btn primary', href: `#/draw?artwork=${a.id}` }, a.status === 'draft' ? '이어 그리기' : '고쳐 그리기'),
          h('button', { class: 'btn', onclick: () => { m.close(); postToBoardSheet(a).catch(toastError); } }, glyph('frame', 18), ' 갤러리보드에 올리기'),
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
      h('div', { class: 'row between', style: { marginBottom: '26px' } }, h('h1', { style: { margin: 0 } }, '작품'), h('button', { class: 'btn primary', onclick: newDrawingSheet }, glyph('plus', 18), ' 새 그림')),
      h('div', { class: 'toolbar-row' }, seg, h('div', { class: 'search' }, search)),
      grid,
    ),
    { active: 'works' },
  );
}
