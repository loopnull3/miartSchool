// 학생 화면: 홈 · 내 작품 · 우리 반 전시회
import { api } from '../api.js';
import { h, clear, modal, emptyState, fmtDate, fmtDateTime, stampEl, confirmDialog, toast } from '../ui.js';
import { shell } from '../app.js';
import { templateThumbSrc } from '../templates.js';

export async function home() {
  const d = await api.get('/student/home');
  const ai = await api.get('/ai/status');
  const s = d.student;
  const todo = d.assignments.filter((g) => !g.submitted_id);
  const done = d.assignments.filter((g) => g.submitted_id);

  const assignmentCard = (g) => {
    const thumb = templateThumbSrc(g.template_ref);
    const href = g.draft_id ? `#/draw?artwork=${g.draft_id}` : `#/draw?assignment=${g.id}`;
    return h('a', { class: 'tile c2', href },
      h('div', { class: 'row nowrap' },
        h('div', { style: { width: '88px', height: '66px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' } },
          thumb ? h('img', { src: thumb, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain' } }) : h('span', { style: { fontSize: '34px' } }, '🎨')),
        h('div', { class: 'grow' },
          h('div', { class: 'tile-title', style: { fontSize: '1.2rem' } }, g.title),
          h('div', { class: 'tile-sub' }, g.description || '선생님이 낸 과제예요'),
          h('div', { class: 'row mt', style: { gap: '6px', marginTop: '6px' } },
            g.submitted_id ? h('span', { class: 'badge ok' }, '✔ 제출함') : g.draft_id ? h('span', { class: 'badge warn' }, '이어 그리기') : h('span', { class: 'badge primary' }, '새 과제'),
            g.due_date ? h('span', { class: 'badge' }, `마감 ${g.due_date}`) : null,
          ),
        ),
      ),
    );
  };

  const psych = d.psych.filter((p) => !p.done);
  const actions = [
    ['c1', '🖌️', '자유롭게 그리기', '하얀 도화지에 마음껏', '#/draw'],
    ['c3', '🖍️', '도안 색칠하기', '귀여운 도안을 골라요', '#/templates/builtin'],
    ['c5', '📷', '사진으로 도안', '사진이 색칠 도안으로!', '#/templates/photo'],
    ai.enabled ? ['c6', '✨', 'AI 도안', '말하면 그림이 나와요', '#/templates/ai'] : null,
    ['c4', '🗂️', '내 작품', d.newFeedback ? `새 칭찬 ${d.newFeedback}개!` : '그린 그림 모아 보기', '#/s/works'],
    d.klass.gallery_enabled ? ['c2', '🖼️', '우리 반 전시회', '친구들 작품 구경', '#/s/gallery'] : null,
  ].filter(Boolean);

  return shell(
    h('div', null,
      h('div', { class: 'row nowrap' },
        h('span', { class: 'avatar lg' }, s.avatar),
        h('div', null, h('h1', { style: { margin: 0 } }, `${s.name}, 반가워요!`), h('p', { class: 'muted', style: { margin: 0 } }, `${d.klass.name} · 오늘은 무엇을 그려 볼까요?`)),
      ),
      psych.length
        ? h('a', { class: 'tile c6 mt-lg', href: `#/s/psych/${psych[0].id}`, style: { display: 'flex', alignItems: 'center', gap: '16px' } },
            h('div', { style: { fontSize: '52px' } }, '💗'),
            h('div', null, h('div', { class: 'tile-title' }, psych[0].title), h('div', { class: 'tile-sub' }, '집·나무·사람을 그리고 내 마음 날씨를 알려 주세요. 정답은 없어요!')),
          )
        : null,
      h('h2', { class: 'mt-lg' }, '📝 오늘의 과제'),
      todo.length ? h('div', { class: 'grid two' }, todo.map(assignmentCard)) : h('p', { class: 'muted' }, '지금은 해야 할 과제가 없어요. 자유롭게 그려 볼까요?'),
      done.length ? h('details', { class: 'mt' }, h('summary', { class: 'muted', style: { cursor: 'pointer', fontWeight: 700 } }, `제출한 과제 ${done.length}개`), h('div', { class: 'grid two mt' }, done.map(assignmentCard))) : null,
      h('h2', { class: 'mt-lg' }, '🎨 그리기'),
      h('div', { class: 'grid three' },
        actions.map(([c, e, t, sub, href]) => h('a', { class: `tile ${c}`, href }, h('div', { class: 'tile-emoji' }, e), h('div', { class: 'tile-title' }, t), h('div', { class: 'tile-sub' }, sub))),
      ),
    ),
    { active: 'home' },
  );
}

function workTile(a, onClick) {
  return h('button', { class: 'art', onclick: onClick },
    h('div', { class: 'art-img' },
      a.status === 'submitted' || a.has_draft ? h('img', { src: `/api/artworks/${a.id}/image?thumb=1&v=${encodeURIComponent(a.updated_at)}`, alt: a.title, loading: 'lazy', onerror: (e) => e.target.remove() }) : null,
      h('div', { class: 'corner' },
        a.status === 'draft' ? h('span', { class: 'badge warn' }, '그리는 중') : h('span', { class: 'badge ok' }, '보냄'),
        !a.seen_feedback ? h('span', { class: 'count-dot' }, 'N') : null,
        a.exhibited ? h('span', { class: 'badge primary' }, '전시') : null,
      ),
    ),
    h('div', { class: 'art-meta' },
      h('div', { class: 'art-title' }, a.title),
      h('div', { class: 'art-sub' }, a.assignment_title ? `📝 ${a.assignment_title}` : '자유 그림', a.feedback_count ? h('span', null, `· 🏅 ${a.feedback_count}`) : null),
      h('div', { class: 'art-sub' }, fmtDate(a.updated_at)),
    ),
  );
}

export async function works() {
  const list = await api.get('/student/artworks');
  const grid = h('div', { class: 'grid tight mt' });
  const render = () => {
    clear(grid);
    if (!list.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('🎨', '아직 작품이 없어요', '첫 그림을 그려 볼까요?', h('a', { class: 'btn primary', href: '#/draw' }, '그리러 가기'))));
      return;
    }
    for (const a of list) grid.append(workTile(a, () => openWork(a)));
  };

  const openWork = async (a) => {
    const detail = await api.get(`/artworks/${a.id}`);
    if (!a.seen_feedback) {
      api.post(`/student/artworks/${a.id}/seen`).catch(() => {});
      a.seen_feedback = true;
      render();
    }
    modal({
      title: a.title,
      wide: true,
      body: h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1.6fr) minmax(220px, 1fr)', alignItems: 'start' } },
        h('img', { src: `/api/artworks/${a.id}/image?v=${encodeURIComponent(a.updated_at)}`, alt: a.title, style: { width: '100%', borderRadius: '14px', border: '1px solid var(--line)', background: '#fff' } }),
        h('div', { class: 'stack' },
          h('div', { class: 'small muted' }, a.assignment_title ? `📝 ${a.assignment_title}` : '자유 그림', ' · ', fmtDateTime(a.updated_at)),
          h('h3', { style: { margin: 0 } }, '선생님의 칭찬'),
          detail.feedback.length
            ? h('div', { class: 'stack' }, detail.feedback.map((f) => h('div', { class: 'row nowrap' }, f.stamp ? stampEl(f.stamp) : null, f.comment ? h('div', { class: 'card flat', style: { padding: '10px 14px' } }, f.comment) : null)))
            : h('p', { class: 'small faint' }, a.status === 'submitted' ? '선생님이 곧 봐 주실 거예요!' : '아직 선생님께 보내지 않았어요.'),
          h('a', { class: 'btn primary', href: `#/draw?artwork=${a.id}` }, a.status === 'draft' ? '🖌️ 이어 그리기' : '🖌️ 고쳐 그리기'),
          a.status === 'draft'
            ? h('button', { class: 'btn danger sm', onclick: async () => {
                if (!(await confirmDialog('이 그림을 지울까요?', { okLabel: '지우기', danger: true }))) return;
                await api.del(`/artworks/${a.id}`);
                list.splice(list.indexOf(a), 1);
                document.querySelector('.modal-back')?.remove();
                render();
                toast('지웠어요');
              } }, '지우기')
            : null,
        ),
      ),
    });
  };
  render();
  return shell(h('div', null, h('div', { class: 'row between' }, h('h1', { style: { margin: 0 } }, '🗂️ 내 작품'), h('a', { class: 'btn primary', href: '#/draw' }, '+ 새 그림')), grid), { active: 'works' });
}

export async function gallery() {
  const list = await api.get('/student/gallery');
  const grid = h('div', { class: 'grid tight mt' });
  if (!list.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('🖼️', '아직 전시된 작품이 없어요', '선생님이 멋진 작품을 골라 전시회에 걸어 줄 거예요.')));
  for (const a of list) {
    grid.append(
      h('button', { class: 'art', onclick: () => modal({ title: `${a.student_avatar} ${a.student_name}의 「${a.title}」`, wide: true, body: h('img', { src: `/api/artworks/${a.id}/image`, alt: a.title, style: { width: '100%', borderRadius: '14px', background: '#fff' } }) }) },
        h('div', { class: 'art-img' }, h('img', { src: `/api/artworks/${a.id}/image?thumb=1`, alt: a.title, loading: 'lazy' })),
        h('div', { class: 'art-meta' }, h('div', { class: 'art-title' }, a.title), h('div', { class: 'art-sub' }, `${a.student_avatar} ${a.student_name}`)),
      ),
    );
  }
  return shell(h('div', null, h('h1', null, '🖼️ 우리 반 전시회'), h('p', { class: 'muted' }, '선생님이 고른 멋진 작품들이에요.'), grid), { active: 'gallery' });
}

