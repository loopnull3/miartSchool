// 갤러리보드 — 보드 목록 · 보드 상세(게시물, 좋아요, 올리기)
import { api } from '../api.js';
import { h, clear, fill, modal, toast, toastError, confirmDialog, emptyState, fmtDate, switchInput, loading } from '../ui.js';
import { shell, session, go } from '../app.js';
import { fileToImage } from '../photo-sketch.js';
import { canvasThumb } from '../templates.js';

const EMOJIS = ['🖼️', '🎨', '🌈', '⭐', '🌸', '❄️', '🎄', '🐾', '🚀', '📚', '🏆', '💡'];

function cover(b) {
  const n = b.covers.length;
  if (!n) return h('div', { class: 'board-cover empty' }, b.emoji);
  return h('div', { class: `board-cover n${n}` }, b.covers.map((id) => h('img', { src: `/api/posts/${id}/image?thumb=1`, alt: '', loading: 'lazy' })));
}

function boardCard(b) {
  return h('a', { class: 'board-card', href: `#/boards/${b.id}` },
    cover(b),
    h('div', { class: 'board-meta' },
      h('div', { class: 'row between nowrap' }, h('b', { style: { fontSize: '1.05rem' } }, `${b.emoji} ${b.title}`), h('span', { class: `badge ${b.scope === 'school' ? 'primary' : ''}` }, b.scope === 'school' ? '우리 학교' : b.class_name || '우리 반')),
      h('div', { class: 'small muted', style: { marginTop: '4px' } }, b.description || `${b.teacher_name || ''} 선생님의 보드`),
      h('div', { class: 'tiny faint', style: { marginTop: '6px' } }, `작품 ${b.post_count}개`),
    ),
  );
}

export async function boardEditor(existing, onSaved) {
  const isNew = !existing;
  const me = session.me.user;
  const classes = isNew ? (await api.get('/classes')).filter((c) => !c.archived) : [];
  const title = h('input', { class: 'input', maxlength: 40, value: existing?.title || '', placeholder: '예) 3학년 2반 겨울 전시회' });
  const desc = h('input', { class: 'input', maxlength: 200, value: existing?.description || '', placeholder: '보드 소개 (선택)' });
  let emoji = existing?.emoji || '🖼️';
  let scope = 'class';
  let studentPosts = existing ? existing.student_posts : true;
  const emojiRow = h('div', { class: 'chips' });
  const renderEmoji = () => fill(emojiRow, ...EMOJIS.map((e) => h('button', { class: `chip ${emoji === e ? 'on' : ''}`, style: { fontSize: '1.2rem', padding: '0 12px' }, onclick: () => { emoji = e; renderEmoji(); } }, e)));
  renderEmoji();
  const classSel = h('select', { class: 'input' }, classes.map((c) => h('option', { value: c.id }, c.name)));
  const classField = h('label', { class: 'field' }, '학급', classSel);
  const scopeSeg = h('div', { class: 'segmented' });
  const renderScope = () => {
    fill(scopeSeg, 
      h('button', { class: scope === 'class' ? 'on' : '', onclick: () => { scope = 'class'; renderScope(); } }, '우리 반'),
      h('button', { class: scope === 'school' ? 'on' : '', onclick: () => { if (!me.school_id) return toast('학교 인증 코드로 가입한 선생님만 학교 보드를 만들 수 있어요.'); scope = 'school'; renderScope(); } }, '우리 학교'),
    );
    classField.classList.toggle('hidden', scope !== 'class');
  };
  renderScope();
  modal({
    title: isNew ? '새 갤러리보드' : '보드 설정',
    body: h('div', { class: 'stack' },
      h('label', { class: 'field' }, '보드 이름', title),
      h('label', { class: 'field' }, '소개', desc),
      h('div', { class: 'field' }, '아이콘', emojiRow),
      isNew ? h('div', { class: 'field' }, '누가 볼 수 있나요?', scopeSeg, h('span', { class: 'hint' }, '우리 학교: 같은 학교 선생님과 학생 모두 볼 수 있어요.')) : null,
      isNew ? classField : null,
      h('label', { class: 'check' }, switchInput(studentPosts, (v) => (studentPosts = v)), '학생도 작품을 올릴 수 있어요'),
    ),
    actions: [
      { label: '취소' },
      {
        label: isNew ? '만들기' : '저장',
        class: 'primary',
        onClick: async () => {
          const payload = { title: title.value, description: desc.value, emoji, studentPosts };
          const b = isNew ? await api.post('/boards', { ...payload, scope, classId: scope === 'class' ? classSel.value : null }) : await api.patch(`/boards/${existing.id}`, payload);
          toast(isNew ? '보드를 만들었어요' : '저장했어요', 'ok');
          onSaved?.(b);
        },
      },
    ],
  });
}

export async function boardsPage() {
  const list = await api.get('/boards');
  const isTeacher = session.me.kind === 'user';
  let filter = 'all';
  const grid = h('div', { class: 'grid' });
  const seg = h('div', { class: 'segmented' });
  const render = () => {
    fill(seg, ...[['all', '전체'], ['class', '우리 반'], ['school', '우리 학교']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; render(); } }, l)));
    clear(grid);
    const items = list.filter((b) => filter === 'all' || b.scope === filter);
    if (!items.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('🖼️', '아직 보드가 없어요', isTeacher ? '보드를 만들면 학생들이 작품을 올리고 서로 감상할 수 있어요.' : '선생님이 보드를 만들면 여기에 나타나요.')));
    items.forEach((b) => grid.append(boardCard(b)));
  };
  render();
  return shell(
    h('div', null,
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, '갤러리보드'), h('p', { class: 'sub' }, '우리 반, 우리 학교의 작품을 안전하게 나누고 감상해요.')),
        h('div', { class: 'row' }, seg, isTeacher ? h('button', { class: 'btn primary', onclick: () => boardEditor(null, (b) => go(`/boards/${b.id}`)) }, '+ 새 보드') : null),
      ),
      grid,
    ),
    { active: 'boards' },
  );
}

async function imageFileToData(file) {
  const img = await fileToImage(file);
  const s = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { image: c.toDataURL('image/jpeg', 0.88), thumb: canvasThumb(c, 480) };
}

async function postSheet(board, onPosted) {
  const isTeacher = session.me.kind === 'user';
  let mode = 'art';
  let picked = null;
  let upload = null;
  const area = h('div');
  const caption = h('input', { class: 'input', maxlength: 40, placeholder: '제목' });
  const text = h('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: '작품 소개 (선택)' });
  const seg = h('div', { class: 'segmented' });

  async function renderArt() {
    fill(area, loading());
    let arts = [];
    if (isTeacher) {
      const classes = (await api.get('/classes')).filter((c) => !c.archived && (board.class_id == null || c.id === board.class_id));
      for (const c of classes) arts.push(...(await api.get(`/classes/${c.id}/artworks`)));
    } else arts = (await api.get('/student/artworks')).filter((a) => a.status === 'submitted' || a.has_draft);
    clear(area);
    if (!arts.length) return area.append(h('p', { class: 'muted' }, '올릴 수 있는 작품이 없어요.'));
    const grid = h('div', { class: 'tpl-grid', style: { maxHeight: '340px', overflow: 'auto', padding: '4px' } });
    const draw = () => {
      fill(grid, 
        ...arts.map((a) =>
          h('button', { class: `tpl ${picked?.id === a.id ? 'active' : ''}`, onclick: () => { picked = a; caption.value = a.title; draw(); } },
            h('div', { class: 'tpl-img' }, h('img', { src: `/api/artworks/${a.id}/image?thumb=1`, alt: a.title, loading: 'lazy' })),
            a.student_name ? `${a.student_avatar} ${a.student_name}` : a.title),
        ),
      );
    };
    draw();
    area.append(grid);
  }
  function renderUpload() {
    const preview = h('div', { class: 'sketch-box', style: { aspectRatio: '16 / 10' } }, h('span', { class: 'muted' }, '📷 사진을 골라 주세요'));
    const file = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        upload = await imageFileToData(f);
        fill(preview, h('img', { src: upload.thumb, alt: '' }));
      } catch (ex) {
        toastError(ex);
      }
    } });
    fill(area, preview, file, h('button', { class: 'btn mt', onclick: () => file.click() }, '사진 고르기'), h('p', { class: 'small faint' }, '종이에 그린 작품 사진도 올릴 수 있어요.'));
  }
  const render = () => {
    fill(seg, h('button', { class: mode === 'art' ? 'on' : '', onclick: () => { mode = 'art'; render(); } }, isTeacher ? '학급 작품' : '내 작품'), h('button', { class: mode === 'upload' ? 'on' : '', onclick: () => { mode = 'upload'; render(); } }, '사진 올리기'));
    if (mode === 'art') renderArt().catch(toastError);
    else renderUpload();
  };
  render();
  modal({
    title: `${board.emoji} ${board.title}에 올리기`,
    wide: true,
    body: h('div', { class: 'stack' }, seg, area, caption, text),
    actions: [
      { label: '취소' },
      {
        label: '올리기',
        class: 'primary',
        onClick: async () => {
          const payload = { title: caption.value, body: text.value };
          if (mode === 'art') {
            if (!picked) {
              toast('올릴 작품을 골라 주세요.');
              return true;
            }
            payload.artworkId = picked.id;
          } else {
            if (!upload) {
              toast('사진을 골라 주세요.');
              return true;
            }
            Object.assign(payload, upload);
          }
          await api.post(`/boards/${board.id}/posts`, payload);
          toast('보드에 올렸어요 🎉', 'ok');
          onPosted?.();
        },
      },
    ],
  });
}

export async function boardPage({ params }) {
  let data = await api.get(`/boards/${params.id}`);
  const wall = h('div', { class: 'masonry' });
  const head = h('div');
  const reload = async () => {
    data = await api.get(`/boards/${params.id}`);
    render();
  };
  const postEl = (p) => {
    const likeBtn = h('button', { class: `like ${p.liked ? 'on' : ''}`, 'aria-pressed': String(p.liked), 'aria-label': '좋아요', onclick: async () => {
      try {
        const u = await api.post(`/posts/${p.id}/like`);
        Object.assign(p, u);
        likeBtn.className = `like ${p.liked ? 'on' : ''}`;
        likeBtn.lastChild.textContent = String(p.likes);
        likeBtn.firstChild.textContent = p.liked ? '♥' : '♡';
      } catch (ex) {
        toastError(ex);
      }
    } }, h('span', null, p.liked ? '♥' : '♡'), h('span', null, String(p.likes)));
    const canDelete = p.mine || data.board.can_manage;
    return h('div', { class: 'post' },
      h('img', { src: `/api/posts/${p.id}/image?thumb=1`, alt: p.title || '작품', loading: 'lazy', onclick: () => modal({ title: p.title || '작품', wide: true, body: h('div', null, h('img', { src: `/api/posts/${p.id}/image`, alt: '', style: { width: '100%', borderRadius: '14px', background: '#fff' } }), p.body ? h('p', { class: 'muted mt' }, p.body) : null, h('p', { class: 'small faint' }, `${p.author.avatar} ${p.author.name} · ${fmtDate(p.created_at)}`)) }) }),
      h('div', { class: 'post-body' },
        p.title ? h('div', { class: 'post-title' }, p.title) : null,
        p.body ? h('div', { class: 'post-text' }, p.body) : null,
        h('div', { class: 'post-foot' },
          h('span', null, `${p.author.avatar} ${p.author.name}`),
          h('div', { class: 'row nowrap', style: { gap: '2px' } },
            likeBtn,
            canDelete ? h('button', { class: 'like', 'aria-label': '게시물 삭제', title: '삭제', onclick: async () => {
              if (!(await confirmDialog('이 게시물을 지울까요?', { okLabel: '지우기', danger: true }))) return;
              await api.del(`/posts/${p.id}`);
              reload();
            } }, '🗑') : null,
          ),
        ),
      ),
    );
  };
  function render() {
    const b = data.board;
    fill(head, 
      h('a', { href: '#/boards', class: 'small' }, '‹ 갤러리보드'),
      h('div', { class: 'page-head', style: { marginTop: '6px' } },
        h('div', null,
          h('h1', null, `${b.emoji} ${b.title}`),
          h('p', { class: 'sub' }, b.description || '', ' ', h('span', { class: `badge ${b.scope === 'school' ? 'primary' : ''}` }, b.scope === 'school' ? '우리 학교' : b.class_name || '우리 반'), b.student_posts ? null : h('span', { class: 'badge', style: { marginLeft: '6px' } }, '선생님만 올리기')),
        ),
        h('div', { class: 'row' },
          b.can_manage ? h('button', { class: 'btn', onclick: () => boardEditor(b, reload) }, '설정') : null,
          b.can_manage ? h('button', { class: 'btn danger', onclick: async () => {
            if (!(await confirmDialog('보드와 올라온 게시물을 모두 지울까요?', { okLabel: '보드 삭제', danger: true }))) return;
            await api.del(`/boards/${b.id}`);
            go('/boards');
          } }, '삭제') : null,
          data.can_post ? h('button', { class: 'btn primary', onclick: () => postSheet(b, reload) }, '+ 작품 올리기') : null,
        ),
      ),
    );
    clear(wall);
    for (const p of data.posts) wall.append(postEl(p));
    clear(emptyBox);
    if (!data.posts.length) emptyBox.append(emptyState('🎨', '아직 올라온 작품이 없어요', data.can_post ? '첫 작품을 올려 보세요!' : '곧 멋진 작품이 올라올 거예요.'));
  }
  const emptyBox = h('div');
  render();
  return shell(h('div', null, head, wall, emptyBox), { active: 'boards' });
}
