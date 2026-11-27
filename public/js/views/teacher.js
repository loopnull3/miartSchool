// 교사 화면: 학급 목록 · 학급 상세(학생/과제/갤러리/마음 탐색/설정) · 로그인 카드 · 계정
import { api } from '../api.js';
import { h, clear, fill, toast, toastError, modal, confirmDialog, promptDialog, emptyState, fmtDate, fmtDateTime, switchInput, stampEl, loading } from '../ui.js';
import { go, shell, session } from '../app.js';
const TECH = { watercolor: '수채화', oil: '유화' };
const PAPERS = [['', '기본'], ['white', '흰 도화지'], ['ivory', '미색 도화지'], ['kraft', '크라프트지'], ['black', '검정 도화지'], ['watercolor', '수채화지'], ['canvas', '캔버스']];
import { templatePicker } from './templates.js';
import { templateThumbSrc } from '../templates.js';
import { ANIMALS, FRUITS } from '/shared/login-pictures.js';
import { checkinTab } from './checkin.js';
import { appIcon, glyph, avatarEl, animalIcon, fruitIcon, boardIcon } from '../icons.js';
import { boardEditor } from './boards.js';

export async function home() {
  const classes = await api.get('/classes');
  const list = h('div', { class: 'grid mt' });
  const active = classes.filter((c) => !c.archived);
  const archived = classes.filter((c) => c.archived);
  for (const c of active) list.append(classCard(c));
  list.append(
    h('button', { class: 'tile', style: { border: '2px dashed var(--line-2)', boxShadow: 'none', background: 'transparent', display: 'grid', placeItems: 'center', minHeight: '150px' }, onclick: createClass },
      h('div', { class: 'center' }, h('div', { class: 'tile-emoji', style: { color: 'var(--ink-3)' } }, glyph('plus', 40, 1.6)), h('div', { class: 'tile-title' }, '새 학급 만들기'))),
  );
  const me = session.me.user;
  return shell(
    h('div', null,
      h('div', { class: 'row between' },
        h('div', null, h('h1', null, `${me.name} 선생님, 안녕하세요!`), h('p', { class: 'muted', style: { margin: 0 } }, me.school_name || '오늘도 즐거운 미술 수업 되세요.')),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/t/lessons' }, glyph('book', 18), ' 수업 자료'), h('a', { class: 'btn', href: '#/try/watercolor' }, glyph('brush', 18), ' 드로잉 체험')),
      ),
      active.length ? null : h('div', { class: 'notice info mt' }, '먼저 학급을 만들고 학생을 등록해 보세요. 학생마다 QR 로그인 카드(참여 코드 + 동물·과일 그림)가 만들어져요.'),
      list,
      archived.length
        ? h('details', { class: 'mt-lg' }, h('summary', { class: 'muted', style: { cursor: 'pointer', fontWeight: 700 } }, `보관한 학급 ${archived.length}개`), h('div', { class: 'grid mt' }, archived.map(classCard)))
        : null,
    ),
    { active: 'classes' },
  );
}

function classCard(c) {
  return h('a', { class: `tile ${['c1', 'c2', 'c3', 'c4', 'c5', 'c6'][c.id % 6]}`, href: `#/t/c/${c.id}` },
    h('div', { class: 'row between' }, h('div', { class: 'tile-title' }, c.name), c.unreviewed_count ? h('span', { class: 'count-dot', title: '피드백 대기 작품' }, c.unreviewed_count) : null),
    h('div', { class: 'tile-sub' }, c.grade || ''),
    h('div', { class: 'row mt', style: { gap: '8px' } },
      h('span', { class: 'badge' }, `학생 ${c.student_count}명`),
      h('span', { class: 'badge' }, `작품 ${c.artwork_count}`),
      c.open_assignments ? h('span', { class: 'badge primary' }, `과제 ${c.open_assignments}`) : null,
      c.archived ? h('span', { class: 'badge warn' }, '보관됨') : null,
    ),
  );
}

function createClass() {
  const name = h('input', { class: 'input', placeholder: '예) 3학년 2반, 토요 드로잉반', maxlength: 40 });
  const grade = h('input', { class: 'input', placeholder: '예) 초등 3학년 (선택)', maxlength: 20 });
  modal({
    title: '새 학급 만들기',
    body: h('div', { class: 'stack' }, h('label', { class: 'field' }, '학급 이름', name), h('label', { class: 'field' }, '학년/대상', grade)),
    actions: [
      { label: '취소' },
      { label: '만들기', class: 'primary', onClick: async () => {
        const c = await api.post('/classes', { name: name.value, grade: grade.value });
        toast('학급을 만들었어요!', 'ok');
        go(`/t/c/${c.id}/students`);
      } },
    ],
  });
  setTimeout(() => name.focus(), 30);
}

// ---------------- 학급 상세 ----------------
const TABS = [
  ['students', '학생'],
  ['assignments', '과제'],
  ['checkin', '마음 날씨'],
  ['gallery', '제출 작품'],
  ['boards', '갤러리보드'],
  ['psych', '마음 탐색'],
  ['settings', '설정'],
];

export async function classPage({ params }) {
  const tab = params.tab || 'students';
  const data = await api.get(`/classes/${params.id}`);
  const k = data.klass;
  const content = h('div');
  const view = shell(
    h('div', null,
      h('div', { class: 'page-head', style: { marginBottom: '14px' } },
        h('div', null,
          h('a', { href: '#/t', class: 'small' }, '‹ 내 학급'),
          h('h1', { style: { margin: '4px 0 0' } }, k.name),
          h('p', { class: 'sub' }, [k.grade, `학생 ${data.students.length}명`].filter(Boolean).join(' · ')),
        ),
        h('a', { class: 'btn', href: `#/t/c/${k.id}/cards` }, glyph('qr', 18), ' 로그인 카드'),
      ),
      h('nav', { class: 'tabs' }, TABS.map(([key, label]) => h('a', { href: `#/t/c/${k.id}/${key}`, class: key === tab ? 'active' : '' }, label))),
      content,
    ),
    { active: 'classes' },
  );
  const renderers = { students: studentsTab, assignments: assignmentsTab, checkin: checkinTab, gallery: galleryTab, boards: boardsTab, psych: psychTab, settings: settingsTab };
  await (renderers[tab] || studentsTab)(content, data);
  return view;
}

// ---- 학생 ----
function loginPics(st) {
  return h('span', { class: 'row nowrap', style: { gap: '2px' } }, animalIcon(st.animal, 30), fruitIcon(st.fruit, 30));
}

async function studentsTab(root, data) {
  const k = data.klass;
  const reveal = new Set();
  const table = h('div');
  const render = () => {
    clear(table);
    if (!data.students.length) {
      table.append(emptyState('classes', '아직 학생이 없어요', '오른쪽에서 학생 이름을 한 줄에 한 명씩 입력해 등록해 보세요.'));
      return;
    }
    table.append(
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, '번호'), h('th', null, '이름'), h('th', null, '참여 코드'), h('th', null, '그림 비밀번호'), h('th', null, '작품'), h('th', null, ''))),
          h('tbody', null,
            data.students.map((st) =>
              h('tr', null,
                h('td', { class: 'num' }, st.number ?? '-'),
                h('td', null, h('div', { class: 'row nowrap', style: { gap: '10px' } }, avatarEl(st, 32), h('b', null, st.name))),
                h('td', null, h('span', { class: 'pin' }, st.access_code || '-')),
                h('td', null, reveal.has(st.id) ? h('button', { class: 'btn sm ghost', style: { padding: '0 6px' }, onclick: () => { reveal.delete(st.id); render(); } }, loginPics(st)) : h('button', { class: 'btn sm ghost', onclick: () => { reveal.add(st.id); render(); } }, '보기')),
                h('td', { class: 'num' }, h('a', { href: `#/t/c/${k.id}/gallery?student=${st.id}` }, `${st.artwork_count}점`)),
                h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, h('button', { class: 'btn sm', onclick: () => editStudent(st) }, '수정')),
              ),
            ),
          ),
        ),
      ),
    );
  };

  const editStudent = (st) => {
    const name = h('input', { class: 'input', value: st.name, maxlength: 20 });
    const number = h('input', { class: 'input', type: 'number', value: st.number ?? '', min: 1, max: 999 });
    let animal = st.animal;
    let fruit = st.fruit;
    const aRow = h('div', { class: 'chips' });
    const fRow = h('div', { class: 'chips' });
    const draw = () => {
      fill(aRow, ...ANIMALS.map((x) => h('button', { class: `pic-chip ${animal === x.key ? 'on' : ''}`, title: x.label, 'aria-label': x.label, onclick: () => { animal = x.key; draw(); } }, animalIcon(x.key, 40))));
      fill(fRow, ...FRUITS.map((x) => h('button', { class: `pic-chip ${fruit === x.key ? 'on' : ''}`, title: x.label, 'aria-label': x.label, onclick: () => { fruit = x.key; draw(); } }, fruitIcon(x.key, 40))));
    };
    draw();
    modal({
      title: '학생 정보',
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '이름', name), h('label', { class: 'field' }, '번호', number)),
        h('div', { class: 'field' }, '참여 코드', h('div', { class: 'row' }, h('span', { class: 'pin', style: { fontSize: '1.3rem' } }, st.access_code), h('button', { class: 'btn sm', onclick: async () => {
          if (!(await confirmDialog(`${st.name} 학생의 참여 코드와 그림 비밀번호를 새로 만들까요? 예전 카드로는 로그인할 수 없어요.`, { okLabel: '새로 만들기' }))) return;
          const u = await api.patch(`/students/${st.id}`, { resetLogin: true });
          Object.assign(st, u);
          render();
          toast('새 로그인 정보를 만들었어요. 카드를 다시 인쇄해 주세요.', 'ok');
        } }, '재발급'))),
        h('div', { class: 'field' }, '그림 비밀번호 · 동물', aRow),
        h('div', { class: 'field' }, '그림 비밀번호 · 과일', fRow),
      ),
      actions: [
        { label: '삭제', class: 'danger', onClick: async () => {
          if (!(await confirmDialog(`${st.name} 학생과 작품을 모두 삭제할까요? 되돌릴 수 없어요.`, { okLabel: '삭제', danger: true }))) return true;
          await api.del(`/students/${st.id}`);
          data.students = data.students.filter((x) => x.id !== st.id);
          render();
        } },
        { label: '저장', class: 'primary', onClick: async () => {
          const u = await api.patch(`/students/${st.id}`, { name: name.value, number: number.value, animal, fruit });
          Object.assign(st, u);
          render();
          toast('저장했어요', 'ok');
        } },
      ],
    });
  };

  const names = h('textarea', { class: 'input', placeholder: '1 김하늘\n2 이바다\n3 박구름', rows: 8 });
  const addCard = h('div', { class: 'card' },
    h('h3', null, '학생 등록'),
    h('p', { class: 'small muted' }, '한 줄에 한 명씩 "번호 이름" 또는 "이름"을 입력하세요. 참여 코드와 그림 비밀번호는 자동으로 만들어져요.'),
    names,
    h('button', { class: 'btn primary block mt', onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const created = await api.post(`/classes/${k.id}/students`, { names: names.value });
        data.students.push(...created.map((x) => ({ ...x, artwork_count: 0 })));
        data.students.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
        names.value = '';
        render();
        toast(`${created.length}명을 등록했어요`, 'ok');
      } catch (ex) {
        toastError(ex);
      } finally {
        btn.disabled = false;
      }
    } }, '등록하기'),
    h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' } }),
    h('h3', null, '학생 로그인 방법'),
    h('ol', { class: 'steps-list small', style: { margin: '10px 0 16px' } },
      h('li', null, '첫 화면에서 ', h('b', null, '학생 로그인')),
      h('li', null, 'QR 카드를 카메라에 비추거나 참여 코드 6자리 입력'),
      h('li', null, '카드에 있는 동물과 과일 그림 고르기'),
    ),
    h('a', { class: 'btn block', href: `#/t/c/${k.id}/cards` }, glyph('print', 18), ' QR 로그인 카드 인쇄'),
  );
  render();
  const layout = h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '20px', alignItems: 'start' } }, table, addCard);
  const mq = window.matchMedia('(max-width: 900px)');
  layout.style.gridTemplateColumns = mq.matches ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px';
  root.append(layout);
}

// ---- 과제 ----
async function assignmentsTab(root, data) {
  const k = data.klass;
  const list = h('div', { class: 'stack' });
  const render = () => {
    clear(list);
    if (!data.assignments.length) {
      list.append(emptyState('assignments', '아직 낸 과제가 없어요', '주제와 도안을 골라 과제를 내 보세요. 학생 홈 화면에 바로 나타나요.'));
      return;
    }
    for (const g of data.assignments) {
      const thumb = templateThumbSrc(g.template_ref);
      list.append(
        h('div', { class: 'card row nowrap', style: { alignItems: 'center' } },
          h('div', { style: { width: '96px', height: '72px', borderRadius: '12px', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none', border: '1px solid var(--line)' } },
            thumb ? h('img', { src: thumb, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain', background: '#fff' } }) : glyph(g.technique === 'oil' ? 'oil' : 'water', 30, 1.4)),
          h('div', { class: 'grow' },
            h('div', { class: 'row', style: { gap: '8px' } }, h('h3', { style: { margin: 0 } }, g.title), g.status === 'closed' ? h('span', { class: 'badge' }, '마감') : h('span', { class: 'badge ok dot' }, '진행 중')),
            g.description ? h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, g.description) : null,
            h('div', { class: 'small faint', style: { marginTop: '4px' } }, h('span', { class: 'badge', style: { marginRight: '6px' } }, TECH[g.technique] || '수채화'), g.start_at ? `${fmtDateTime(g.start_at)} ~ ${g.end_at ? fmtDateTime(g.end_at) : ''}` : `${fmtDate(g.created_at)} 출제${g.end_at ? ` · 마감 ${fmtDateTime(g.end_at)}` : ''}`),
          ),
          h('div', { class: 'stack', style: { alignItems: 'flex-end', gap: '8px' } },
            h('span', { class: 'badge primary' }, `제출 ${g.submitted_count}/${data.students.length}`),
            h('div', { class: 'row', style: { gap: '6px' } },
              h('button', { class: 'btn sm', onclick: () => submissionStatus(g, k) }, '제출 현황'),
              h('button', { class: 'btn sm', onclick: async () => {
                const u = await api.patch(`/assignments/${g.id}`, { status: g.status === 'open' ? 'closed' : 'open' });
                Object.assign(g, u);
                render();
              } }, g.status === 'open' ? '마감' : '다시 열기'),
              h('button', { class: 'btn sm danger', onclick: async () => {
                if (!(await confirmDialog(`'${g.title}' 과제를 삭제할까요? 제출된 작품은 남아 있어요.`, { okLabel: '삭제', danger: true }))) return;
                await api.del(`/assignments/${g.id}`);
                data.assignments = data.assignments.filter((x) => x.id !== g.id);
                render();
              } }, '삭제'),
            ),
          ),
        ),
      );
    }
  };
  render();
  root.append(h('div', { class: 'row between mb' }, h('h2', { style: { margin: 0 } }, '과제'), h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/t/lessons' }, glyph('book', 18), ' 수업 자료에서 가져오기'), h('button', { class: 'btn primary', onclick: () => newAssignment(k, data, render) }, '+ 새 과제'))), list);
}

const localInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function newAssignment(k, data, rerender) {
  const title = h('input', { class: 'input', placeholder: '예) 내가 살고 싶은 집', maxlength: 60 });
  const desc = h('textarea', { class: 'input', placeholder: '학생에게 보여 줄 안내 (선택)', rows: 3, maxlength: 1000 });
  const steps = h('textarea', { class: 'input', placeholder: '활동 순서를 한 줄에 하나씩 (선택)', rows: 3 });
  const now = new Date();
  const start = h('input', { class: 'input', type: 'datetime-local', value: localInput(now) });
  const end = h('input', { class: 'input', type: 'datetime-local', value: localInput(new Date(now.getTime() + 7 * 86400_000)) });
  const paper = h('select', { class: 'input' }, PAPERS.map(([v, t]) => h('option', { value: v }, t)));
  let technique = 'watercolor';
  let orientation = 'landscape';
  let templateRef = null;
  const techSeg = h('div', { class: 'segmented' });
  const oriSeg = h('div', { class: 'segmented' });
  const tplLabel = h('span', { class: 'muted small' });
  const renderSegs = () => {
    fill(techSeg, ...['watercolor', 'oil'].map((x) => h('button', { class: technique === x ? 'on' : '', onclick: () => { technique = x; renderSegs(); } }, x === 'oil' ? [glyph('oil', 18), ' 유화'] : [glyph('water', 18), ' 수채화'])));
    fill(oriSeg, ...[['landscape', '가로'], ['portrait', '세로']].map(([x, t]) => h('button', { class: orientation === x ? 'on' : '', onclick: () => { orientation = x; renderSegs(); } }, t)));
    fill(tplLabel, templateRef ? h('img', { src: templateThumbSrc(templateRef), alt: '', style: { height: '54px', display: 'inline-block', verticalAlign: 'middle', borderRadius: '8px', background: '#fff' } }) : '도안 없이 자유롭게');
  };
  renderSegs();
  const matBox = h('div', { class: 'stack', style: { gap: '8px' } });
  const addMat = () => {
    const t = h('input', { class: 'input', placeholder: '자료 이름', style: { flex: '1' } });
    const u = h('input', { class: 'input', placeholder: 'https:// 유튜브·이미지·링크', style: { flex: '2' } });
    const row = h('div', { class: 'row nowrap mat-row' }, t, u, h('button', { class: 'btn icon sm ghost', 'aria-label': '자료 삭제', onclick: () => row.remove() }, glyph('close', 16)));
    row._get = () => ({ title: t.value, url: u.value.trim() });
    matBox.append(row);
  };
  modal({
    title: '새 과제',
    wide: true,
    body: h('div', { class: 'grid two' },
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, '제목', title),
        h('label', { class: 'field' }, '안내', desc),
        h('label', { class: 'field' }, '활동 순서', steps),
        h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '시작', start), h('label', { class: 'field' }, '마감', end)),
      ),
      h('div', { class: 'stack' },
        h('div', { class: 'field' }, '그리기 도구', techSeg),
        h('div', { class: 'field' }, '도화지 방향', oriSeg),
        h('label', { class: 'field' }, '배경지', paper),
        h('div', { class: 'field' }, '스케치 교재 (도안)', h('div', { class: 'row' }, tplLabel, h('button', { class: 'btn sm', type: 'button', onclick: async () => { const ref = await templatePicker({ allowNone: true, current: templateRef }); if (ref !== undefined) { templateRef = ref; renderSegs(); } } }, '고르기'))),
        h('div', { class: 'field' }, '수업 자료', matBox, h('button', { class: 'btn sm', type: 'button', onclick: addMat }, '+ 자료 추가')),
      ),
    ),
    actions: [
      { label: '취소' },
      { label: '과제 내기', class: 'primary', onClick: async () => {
        const g = await api.post(`/classes/${k.id}/assignments`, {
          title: title.value,
          description: desc.value,
          steps: steps.value.split('\n').map((x) => x.trim()).filter(Boolean),
          templateRef,
          orientation,
          technique,
          paper: paper.value || null,
          startAt: start.value ? new Date(start.value).toISOString() : null,
          endAt: end.value ? new Date(end.value).toISOString() : null,
          materials: [...matBox.querySelectorAll('.mat-row')].map((r) => r._get()).filter((m) => m.url),
        });
        data.assignments.unshift({ ...g, submitted_count: 0 });
        rerender();
        toast('과제를 냈어요!', 'ok');
      } },
    ],
  });
  setTimeout(() => title.focus(), 30);
}

async function submissionStatus(g, k) {
  const body = h('div', null, loading());
  modal({ title: `제출 현황 · ${g.title}`, body, wide: true });
  const st = await api.get(`/assignments/${g.id}/status`);
  const done = st.students.filter((s) => s.artwork_id);
  const missing = st.students.filter((s) => !s.artwork_id);
  fill(body, 
    h('p', { class: 'muted' }, `제출 ${done.length}명 · 미제출 ${missing.length}명`),
    h('div', { class: 'grid tight' },
      done.map((s) =>
        h('button', { class: 'art', onclick: () => reviewArtwork(s.artwork_id, k) },
          h('div', { class: 'art-img' }, h('img', { src: `/api/artworks/${s.artwork_id}/image?thumb=1`, alt: `${s.name} 작품`, loading: 'lazy' })),
          h('div', { class: 'art-meta' }, h('div', { class: 'art-title' }, s.name)),
        ),
      ),
    ),
    missing.length ? h('div', { class: 'mt' }, h('h3', null, '아직 제출하지 않았어요'), h('div', { class: 'chips' }, missing.map((s) => h('span', { class: 'chip', style: { cursor: 'default' } }, avatarEl(s, 22), s.name)))) : null,
  );
}

// ---- 갤러리 ----
async function galleryTab(root, data) {
  const k = data.klass;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const filters = { assignment: q.get('assignment') || '', student: q.get('student') || '', unreviewed: q.get('unreviewed') || '' };
  const grid = h('div', { class: 'grid tight mt' });
  const assignSel = h('select', { class: 'input', style: { width: 'auto' }, onchange: () => { filters.assignment = assignSel.value; load(); } },
    h('option', { value: '' }, '모든 작품'),
    h('option', { value: 'free' }, '자유 그림'),
    data.assignments.map((g) => h('option', { value: g.id }, g.title)),
  );
  assignSel.value = filters.assignment;
  const studentSel = h('select', { class: 'input', style: { width: 'auto' }, onchange: () => { filters.student = studentSel.value; load(); } },
    h('option', { value: '' }, '모든 학생'),
    data.students.map((s) => h('option', { value: s.id }, s.name)),
  );
  studentSel.value = filters.student;
  const unrev = h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!filters.unreviewed, onchange: (e) => { filters.unreviewed = e.target.checked ? '1' : ''; load(); } }), '피드백 안 한 작품만');

  async function load() {
    fill(grid, loading());
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    const items = await api.get(`/classes/${k.id}/artworks${qs ? '?' + qs : ''}`);
    clear(grid);
    if (!items.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('gallery', '작품이 없어요', '학생들이 제출한 작품이 여기에 모여요.')));
      return;
    }
    for (const a of items) grid.append(artTile(a, () => reviewArtwork(a.id, k, load)));
  }
  root.append(h('div', { class: 'row' }, assignSel, studentSel, unrev), grid);
  await load();
}

export function artTile(a, onClick) {
  return h('button', { class: 'art', onclick: onClick },
    h('div', { class: 'art-img' },
      h('img', { src: `/api/artworks/${a.id}/image?thumb=1&v=${encodeURIComponent(a.updated_at)}`, alt: a.title, loading: 'lazy' }),
      h('div', { class: 'corner' }, a.feedback_count ? h('span', { class: 'badge ok' }, '피드백 완료') : null),
    ),
    h('div', { class: 'art-meta' },
      h('div', { class: 'art-title' }, a.title),
      h('div', { class: 'art-sub' }, a.student_name ? a.student_name : '', a.assignment_title ? h('span', null, `· ${a.assignment_title}`) : null),
      h('div', { class: 'art-sub' }, fmtDateTime(a.submitted_at || a.updated_at)),
    ),
  );
}

export async function reviewArtwork(id, k, onChange) {
  const body = h('div', null, loading());
  const m = modal({ title: '작품 보기', body, wide: true });
  const [a, stamps] = await Promise.all([api.get(`/artworks/${id}`), api.get('/stamps')]);
  m.box.querySelector('.modal-head h2').textContent = a.title;
  let selected = null;
  const comment = h('textarea', { class: 'input', rows: 3, maxlength: 300, placeholder: '아이에게 남길 한마디 (선택)' });
  const fbList = h('div', { class: 'stack' });
  const renderFb = (list) => {
    clear(fbList);
    if (!list.length) fbList.append(h('p', { class: 'small faint' }, '아직 남긴 피드백이 없어요.'));
    for (const f of list) {
      fbList.append(
        h('div', { class: 'row nowrap', style: { alignItems: 'center' } },
          f.stamp ? stampEl(f.stamp, true) : null,
          h('div', { class: 'grow' }, f.comment ? h('div', null, f.comment) : null, h('div', { class: 'tiny faint' }, fmtDateTime(f.created_at))),
          h('button', { class: 'btn sm ghost', 'aria-label': '피드백 삭제', onclick: async () => {
            await api.del(`/feedback/${f.id}`);
            renderFb(list.filter((x) => x.id !== f.id));
            onChange?.();
          } }, glyph('close', 16)),
        ),
      );
    }
  };
  renderFb(a.feedback);
  const stampRow = h('div', { class: 'row', style: { gap: '4px' } });
  const renderStamps = () => {
    clear(stampRow);
    for (const s of stamps) stampRow.append(h('button', { class: `stamp-btn ${selected === s ? 'active' : ''}`, title: s, onclick: () => { selected = selected === s ? null : s; renderStamps(); } }, stampEl(s, true)));
  };
  renderStamps();
  const toBoard = h('button', { class: 'btn', onclick: async () => {
    const boards = (await api.get(`/boards?classId=${a.class_id || ''}`)).filter((b) => b.can_manage || b.scope === 'school');
    if (!boards.length) return toast('먼저 갤러리보드를 만들어 주세요. (학급 › 갤러리보드)');
    let pick = boards[0].id;
    const list = h('div', { class: 'chips' });
    const draw = () => fill(list, ...boards.map((b) => h('button', { class: `chip ${pick === b.id ? 'on' : ''}`, onclick: () => { pick = b.id; draw(); } }, boardIcon(b.emoji, 16), b.title)));
    draw();
    modal({ title: '갤러리보드에 올리기', body: list, actions: [{ label: '취소' }, { label: '올리기', class: 'primary', onClick: async () => { await api.post(`/boards/${pick}/posts`, { artworkId: a.id, title: a.title }); toast('갤러리보드에 올렸어요', 'ok'); onChange?.(); } }] });
  } }, glyph('frame', 18), ' 갤러리보드에 올리기');
  const statsLine = a.stats
    ? h('div', { class: 'tiny faint mt' }, `그린 시간 약 ${Math.max(1, Math.round((a.stats.activeMs || 0) / 60000))}분 · 획 ${a.stats.strokeCount ?? 0} · 사용한 색 ${(a.stats.colors || []).length}가지`)
    : null;
  fill(body, 
    h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)', alignItems: 'start' } },
      h('div', null,
        h('img', { src: `/api/artworks/${a.id}/image?v=${encodeURIComponent(a.updated_at)}`, alt: a.title, style: { width: '100%', borderRadius: '14px', border: '1px solid var(--line)', background: '#fff' } }),
        h('div', { class: 'row between mt' },
          h('div', { class: 'small muted' }, a.student_name, a.assignment_title ? ` · ${a.assignment_title}` : '', ` · ${fmtDateTime(a.submitted_at)}`),
          h('a', { class: 'btn sm', href: `/api/artworks/${a.id}/image`, download: `${a.student_name}-${a.title}.png` }, glyph('download', 16), ' 내려받기'),
        ),
        statsLine,
      ),
      h('div', { class: 'stack' },
        h('h3', { style: { margin: 0 } }, '칭찬 도장'),
        stampRow,
        comment,
        h('button', { class: 'btn primary', onclick: async (e) => {
          if (!selected && !comment.value.trim()) return toast('도장이나 한마디를 남겨 주세요.');
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            const list = await api.post(`/artworks/${a.id}/feedback`, { stamp: selected, comment: comment.value });
            selected = null;
            comment.value = '';
            renderStamps();
            renderFb(list);
            toast('피드백을 보냈어요', 'ok');
            onChange?.();
          } catch (ex) {
            toastError(ex);
          } finally {
            btn.disabled = false;
          }
        } }, '피드백 보내기'),
        toBoard,
        h('h3', { style: { margin: '8px 0 0' } }, '남긴 피드백'),
        fbList,
        h('button', { class: 'btn sm danger mt', onclick: async () => {
          if (!(await confirmDialog('이 작품을 삭제할까요? 되돌릴 수 없어요.', { okLabel: '삭제', danger: true }))) return;
          await api.del(`/artworks/${a.id}`);
          m.close();
          onChange?.();
        } }, '작품 삭제'),
      ),
    ),
  );
}

// ---- 마음 탐색 ----
async function psychTab(root, data) {
  const k = data.klass;
  const res = await api.get(`/classes/${k.id}/psych`);
  const list = h('div', { class: 'stack' });
  const render = () => {
    clear(list);
    if (!res.campaigns.length) {
      list.append(emptyState('psych', '아직 진행한 마음 탐색이 없어요', '검사를 열면 학생 홈 화면에 "그림 마음 탐색" 카드가 나타나요. 집·나무·사람을 그리고 질문에 답하는 데 15~25분 정도 걸려요.'));
      return;
    }
    for (const c of res.campaigns) {
      const pct = res.studentCount ? Math.round((c.completed / res.studentCount) * 100) : 0;
      list.append(
        h('div', { class: 'card row nowrap' },
          appIcon('psych', 44),
          h('div', { class: 'grow' },
            h('div', { class: 'row', style: { gap: '8px' } }, h('h3', { style: { margin: 0 } }, c.title), c.status === 'open' ? h('span', { class: 'badge ok dot' }, '참여 중') : h('span', { class: 'badge' }, '닫힘')),
            h('div', { class: 'small muted' }, `${fmtDate(c.created_at)} 시작 · 참여 ${c.completed}/${res.studentCount}명`),
            h('div', { class: 'bar mt', style: { maxWidth: '320px', marginTop: '6px' } }, h('span', { style: { width: `${pct}%`, background: 'var(--mint)' } })),
          ),
          h('div', { class: 'row', style: { gap: '6px' } },
            h('a', { class: 'btn primary sm', href: `#/t/psych/${c.id}` }, '학급 리포트'),
            h('button', { class: 'btn sm', onclick: async () => {
              const u = await api.patch(`/psych/campaigns/${c.id}`, { status: c.status === 'open' ? 'closed' : 'open' });
              Object.assign(c, u);
              render();
            } }, c.status === 'open' ? '닫기' : '다시 열기'),
            h('button', { class: 'btn sm danger', onclick: async () => {
              if (!(await confirmDialog(`'${c.title}'와 모든 결과를 삭제할까요?`, { okLabel: '삭제', danger: true }))) return;
              await api.del(`/psych/campaigns/${c.id}`);
              res.campaigns = res.campaigns.filter((x) => x.id !== c.id);
              render();
            } }, '삭제'),
          ),
        ),
      );
    }
  };
  render();
  root.append(
    h('div', { class: 'row between mb' },
      h('h2', { style: { margin: 0 } }, '그림 마음 탐색'),
      h('button', { class: 'btn primary', onclick: async () => {
        const title = await promptDialog('새 마음 탐색 열기', { label: '제목', value: `${new Date().getMonth() + 1}월 그림 마음 탐색`, okLabel: '열기' });
        if (title == null) return;
        const c = await api.post(`/classes/${k.id}/psych`, { title });
        res.campaigns.unshift({ ...c, completed: 0 });
        render();
        toast('학생 홈 화면에 마음 탐색이 열렸어요', 'ok');
      } }, '+ 새 검사 열기'),
    ),
    h('div', { class: 'notice mb' }, '그림 마음 탐색은 아이를 이해하기 위한 참고 자료이며 진단이 아니에요. 결과는 선생님만 볼 수 있고, 학생에게는 긍정적인 한마디만 보여 줘요.'),
    list,
  );
}

// ---- 설정 ----
async function settingsTab(root, data) {
  const k = data.klass;
  const name = h('input', { class: 'input', value: k.name, maxlength: 40 });
  const grade = h('input', { class: 'input', value: k.grade || '', maxlength: 20 });
  const save = async (patch, msg = '저장했어요') => {
    try {
      Object.assign(k, await api.patch(`/classes/${k.id}`, patch));
      toast(msg, 'ok');
    } catch (ex) {
      toastError(ex);
    }
  };
  const ai = await api.get('/ai/status');
  root.append(
    h('div', { class: 'grid two' },
      h('div', { class: 'card stack' },
        h('h3', null, '학급 정보'),
        h('label', { class: 'field' }, '학급 이름', name),
        h('label', { class: 'field' }, '학년/대상', grade),
        h('button', { class: 'btn primary', onclick: () => save({ name: name.value, grade: grade.value }) }, '저장'),
      ),
      h('div', { class: 'card stack' },
        h('h3', null, '기능 설정'),
        h('label', { class: 'check' }, switchInput(!!k.ai_enabled, (v) => save({ ai_enabled: v }, v ? 'AI 기능을 켰어요' : 'AI 기능을 껐어요')), 'AI 기능 사용 (AI 주제 도안, 마음 탐색 AI 요약)'),
        ai.available ? null : h('div', { class: 'notice warn' }, '서버에 AI 키가 설정되지 않아 AI 기능은 현재 동작하지 않아요. 나머지 기능은 모두 사용할 수 있어요.'),
        h('label', { class: 'check' }, switchInput(!!k.gallery_enabled, (v) => save({ gallery_enabled: v })), '학생들이 갤러리보드 보기'),
        h('label', { class: 'check' }, switchInput(!!k.checkin_enabled, (v) => save({ checkin_enabled: v })), '마음 날씨 체크인 사용'),
      ),
      h('div', { class: 'card stack' },
        h('h3', null, '학급 보관 · 삭제'),
        h('p', { class: 'small muted' }, '학기가 끝나면 학급을 보관하세요. 보관한 학급의 학생은 로그인할 수 없어요.'),
        h('button', { class: 'btn', onclick: () => save({ archived: !k.archived }, k.archived ? '학급을 다시 열었어요' : '학급을 보관했어요').then(() => go('/t')) }, k.archived ? '보관 해제' : '학급 보관'),
        h('button', { class: 'btn danger', onclick: async () => {
          const typed = await promptDialog('학급 삭제', { label: `학생·작품·검사 결과가 모두 지워져요. 확인을 위해 학급 이름 "${k.name}"을 입력하세요.`, okLabel: '영구 삭제' });
          if (typed == null) return;
          try {
            await api.del(`/classes/${k.id}`, { confirm: typed });
            toast('학급을 삭제했어요');
            go('/t');
          } catch (ex) {
            toastError(ex);
          }
        } }, '학급 영구 삭제'),
      ),
    ),
  );
}

// ---- 로그인 카드 인쇄 (QR + 참여 코드 + 그림 비밀번호) ----
export async function loginCards({ params }) {
  const data = await api.get(`/classes/${params.id}`);
  const k = data.klass;
  const { qrSvg } = await import('../qr.js');
  const cards = await Promise.all(
    data.students.map(async (st) => {
      const qr = h('div', { class: 'lp-qr', html: await qrSvg(`${location.origin}/#/qr/${st.access_code}`, { size: null, margin: 2 }) });
      return h('div', { class: 'login-print' },
        h('div', null,
          h('div', { class: 'row nowrap', style: { gap: '8px' } }, avatarEl(st, 30), h('div', { class: 'lp-name' }, st.name)),
          h('div', { class: 'small muted', style: { margin: '2px 0 8px' } }, `${k.name}${st.number ? ` · ${st.number}번` : ''}`),
          h('div', { class: 'tiny faint' }, '참여 코드'),
          h('div', { class: 'lp-code' }, st.access_code),
          h('div', { class: 'tiny faint', style: { marginTop: '6px' } }, '그림 비밀번호'),
          h('div', { class: 'lp-pics' }, animalIcon(st.animal, 36), fruitIcon(st.fruit, 36)),
        ),
        qr,
      );
    }),
  );
  return shell(
    h('div', null,
      h('div', { class: 'row between no-print mb' },
        h('a', { href: `#/t/c/${k.id}/students`, class: 'btn ghost' }, '‹ 돌아가기'),
        h('button', { class: 'btn primary', onclick: () => window.print() }, glyph('print', 18), ' 인쇄하기'),
      ),
      h('div', { class: 'no-print' }, h('h1', null, `${k.name} 로그인 카드`), h('p', { class: 'muted' }, '잘라서 나눠 주세요. 아이패드 카메라 앱으로 QR을 비추면 바로 로그인 화면이 열려요.')),
      data.students.length ? h('div', { class: 'cards-print' }, cards) : emptyState('classes', '등록된 학생이 없어요'),
    ),
    { active: 'classes' },
  );
}

// ---- 갤러리보드 (학급) ----
async function boardsTab(root, data) {
  const k = data.klass;
  const list = await api.get(`/boards?classId=${k.id}`);
  const grid = h('div', { class: 'grid' });
  if (!list.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('gallery', '아직 보드가 없어요', '보드를 만들면 학생들이 작품을 올리고 서로 감상할 수 있어요.')));
  for (const b of list) {
    grid.append(
      h('a', { class: 'board-card', href: `#/boards/${b.id}` },
        h('div', { class: 'board-meta' }, h('div', { class: 'row between nowrap' }, h('b', { class: 'row nowrap', style: { gap: '6px' } }, boardIcon(b.emoji, 20), b.title), h('span', { class: `badge ${b.scope === 'school' ? 'primary' : ''}` }, b.scope === 'school' ? '우리 학교' : '우리 반')), h('div', { class: 'tiny faint', style: { marginTop: '6px' } }, `작품 ${b.post_count}개`)),
      ),
    );
  }
  root.append(h('div', { class: 'row between mb' }, h('h2', { style: { margin: 0 } }, '갤러리보드'), h('button', { class: 'btn primary', onclick: () => boardEditor(null, (b) => go(`/boards/${b.id}`)) }, '+ 새 보드')), grid);
}

export function account() {
  const me = session.me.user;
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8 });
  return shell(
    h('div', { class: 'page narrow' },
      h('div', { class: 'card pad-lg' },
        h('h1', null, '내 계정'),
        h('p', { class: 'muted' }, `${me.name} · ${me.email}`, me.school_name ? ` · ${me.school_name}` : ''),
        h('h3', { class: 'mt' }, '비밀번호 바꾸기'),
        h('div', { class: 'stack' },
          h('label', { class: 'field' }, '현재 비밀번호', cur),
          h('label', { class: 'field' }, '새 비밀번호 (8자 이상)', next),
          h('button', { class: 'btn primary', onclick: async () => {
            try {
              await api.post('/auth/password', { current: cur.value, next: next.value });
              cur.value = next.value = '';
              toast('비밀번호를 바꿨어요', 'ok');
            } catch (ex) {
              toastError(ex);
            }
          } }, '변경'),
        ),
      ),
    ),
    { wide: '' },
  );
}
