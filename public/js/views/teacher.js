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
      h('h1', null, '내 학급'),
      h('p', { class: 'muted', style: { margin: 0 } }, [me.name + ' 선생님', me.school_name].filter(Boolean).join(' · ')),
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
    h('div', { class: 'tile-sub' }, [c.grade, `학생 ${c.student_count}명`, c.open_assignments ? `과제 ${c.open_assignments}` : null, c.archived ? '보관됨' : null].filter(Boolean).join(' · ')),
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
// 탭은 5개만: 마음 날씨 · 그림 마음 탐색은 '마음' 탭 안에서, 갤러리보드는 왼쪽 '갤러리'에서
const TABS = [
  ['students', '학생'],
  ['assignments', '과제'],
  ['gallery', '작품'],
  ['checkin', '마음', ['checkin', 'psych']],
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
        ),
      ),
      h('nav', { class: 'tabs' }, TABS.map(([key, label, group]) => h('a', { href: `#/t/c/${k.id}/${key}`, class: (group || [key]).includes(tab) ? 'active' : '' }, label))),
      tab === 'checkin' || tab === 'psych'
        ? h('div', { class: 'segmented', style: { margin: '0 0 18px' } },
            h('a', { class: tab === 'checkin' ? 'on' : '', href: `#/t/c/${k.id}/checkin` }, '마음 날씨'),
            h('a', { class: tab === 'psych' ? 'on' : '', href: `#/t/c/${k.id}/psych` }, '그림 마음 탐색'))
        : null,
      content,
    ),
    { active: 'classes' },
  );
  const renderers = { students: studentsTab, assignments: assignmentsTab, checkin: checkinTab, gallery: galleryTab, boards: boardsTab, psych: psychTab, settings: settingsTab };
  await (renderers[tab] || studentsTab)(content, data);
  return view;
}

// ---- 학생 ----
const labelOf = (list, key) => list.find((x) => x.key === key)?.label || '';

// 학급 공통 그림 비밀번호 고르기 시트. 저장하면 갱신된 학급을 돌려준다.
function classPictureSheet(k, onSaved) {
  let animal = k.login_animal;
  let fruit = k.login_fruit;
  const aRow = h('div', { class: 'chips' });
  const fRow = h('div', { class: 'chips' });
  const draw = () => {
    fill(aRow, ...ANIMALS.map((x) => h('button', { class: `pic-chip ${animal === x.key ? 'on' : ''}`, title: x.label, 'aria-label': x.label, 'aria-pressed': String(animal === x.key), onclick: () => { animal = x.key; draw(); } }, animalIcon(x.key, 44))));
    fill(fRow, ...FRUITS.map((x) => h('button', { class: `pic-chip ${fruit === x.key ? 'on' : ''}`, title: x.label, 'aria-label': x.label, 'aria-pressed': String(fruit === x.key), onclick: () => { fruit = x.key; draw(); } }, fruitIcon(x.key, 44))));
  };
  draw();
  modal({
    title: '우리 반 그림 비밀번호',
    body: h('div', { class: 'stack' },
      h('p', { class: 'small muted', style: { margin: 0 } }, `${k.name} 학생 모두가 이 동물과 과일을 골라 로그인해요. 바꾸면 다음 로그인부터 새 그림을 써요.`),
      h('div', { class: 'field' }, '1. 동물', aRow),
      h('div', { class: 'field' }, '2. 과일', fRow),
    ),
    actions: [
      { label: '취소' },
      { label: '저장', class: 'primary', onClick: async () => {
        try {
          onSaved(await api.patch(`/classes/${k.id}`, { loginAnimal: animal, loginFruit: fruit }));
          toast('그림 비밀번호를 바꿨어요. 학생들에게 알려 주세요.', 'ok');
        } catch (ex) {
          toastError(ex);
          return true;
        }
      } },
    ],
  });
}

async function studentsTab(root, data) {
  const k = data.klass;
  const table = h('div');
  const picCard = h('div', { class: 'card class-pic' });
  const applyClass = (u) => {
    Object.assign(k, u);
    for (const st of data.students) Object.assign(st, { animal: k.login_animal, fruit: k.login_fruit });
    renderPic();
  };
  const renderPic = () => {
    fill(picCard,
      h('div', { class: 'row between', style: { alignItems: 'center', gap: '16px' } },
        h('div', { class: 'row nowrap', style: { gap: '14px', alignItems: 'center' } },
          h('div', { class: 'row nowrap class-pic-icons', style: { gap: '6px' } },
            h('figure', null, animalIcon(k.login_animal, 52), h('figcaption', null, labelOf(ANIMALS, k.login_animal))),
            h('span', { class: 'class-pic-arrow' }, glyph('right', 18)),
            h('figure', null, fruitIcon(k.login_fruit, 52), h('figcaption', null, labelOf(FRUITS, k.login_fruit))),
          ),
          h('div', null,
            h('b', null, '우리 반 그림 비밀번호'),
            h('div', { class: 'small muted' }, '반 친구 모두 같아요'),
          ),
        ),
        h('div', { class: 'row nowrap', style: { gap: '8px' } },
          h('button', { class: 'btn sm', onclick: async () => {
            if (!(await confirmDialog('우리 반 그림 비밀번호를 새로 뽑을까요? 학생들은 다음 로그인부터 새 그림을 골라야 해요.', { okLabel: '새로 뽑기' }))) return;
            try {
              applyClass(await api.patch(`/classes/${k.id}`, { resetLoginPicture: true }));
              toast('새 그림 비밀번호를 뽑았어요', 'ok');
            } catch (ex) {
              toastError(ex);
            }
          } }, '새로 뽑기'),
          h('button', { class: 'btn sm primary', onclick: () => classPictureSheet(k, applyClass) }, '바꾸기'),
        ),
      ),
    );
  };
  renderPic();
  const render = () => {
    clear(table);
    if (!data.students.length) {
      table.append(emptyState('classes', '아직 학생이 없어요', '오른쪽 위 학생 추가를 눌러 이름을 넣어 주세요.'));
      return;
    }
    table.append(
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, '번호'), h('th', null, '이름'), h('th', null, '참여 코드'), h('th', null, '작품'), h('th', null, ''))),
          h('tbody', null,
            data.students.map((st) =>
              h('tr', null,
                h('td', { class: 'num' }, st.number ?? '-'),
                h('td', null, h('div', { class: 'row nowrap', style: { gap: '10px' } }, avatarEl(st, 32), h('b', null, st.name))),
                h('td', null, h('span', { class: 'pin' }, st.access_code || '-')),
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
    modal({
      title: '학생 정보',
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '이름', name), h('label', { class: 'field' }, '번호', number)),
        h('div', { class: 'field' }, '참여 코드', h('div', { class: 'row' }, h('span', { class: 'pin', style: { fontSize: '1.3rem' } }, st.access_code), h('button', { class: 'btn sm', onclick: async () => {
          if (!(await confirmDialog(`${st.name} 학생의 참여 코드를 새로 만들까요? 예전 카드로는 로그인할 수 없어요.`, { okLabel: '새로 만들기' }))) return;
          const u = await api.patch(`/students/${st.id}`, { resetLogin: true });
          Object.assign(st, u);
          render();
          toast('새 참여 코드를 만들었어요. 카드를 다시 인쇄해 주세요.', 'ok');
        } }, '재발급'))),
        h('div', { class: 'field' }, '그림 비밀번호', h('div', { class: 'row nowrap', style: { gap: '6px', alignItems: 'center' } }, animalIcon(k.login_animal, 36), fruitIcon(k.login_fruit, 36), h('span', { class: 'small muted' }, '우리 반 공통 · 학생 목록 위에서 바꿀 수 있어요'))),
      ),
      actions: [
        { label: '삭제', class: 'danger', onClick: async () => {
          if (!(await confirmDialog(`${st.name} 학생과 작품을 모두 삭제할까요? 되돌릴 수 없어요.`, { okLabel: '삭제', danger: true }))) return true;
          await api.del(`/students/${st.id}`);
          data.students = data.students.filter((x) => x.id !== st.id);
          render();
        } },
        { label: '저장', class: 'primary', onClick: async () => {
          const u = await api.patch(`/students/${st.id}`, { name: name.value, number: number.value });
          Object.assign(st, u);
          render();
          toast('저장했어요', 'ok');
        } },
      ],
    });
  };

  const addStudents = () => {
    const names = h('textarea', { class: 'input', placeholder: '1 김하늘\n2 이바다\n3 박구름', rows: 8 });
    modal({
      title: '학생 추가',
      body: h('div', { class: 'stack' }, h('p', { class: 'small muted', style: { margin: 0 } }, '한 줄에 한 명씩 "번호 이름" 또는 "이름"'), names),
      actions: [
        { label: '취소' },
        { label: '추가', class: 'primary', onClick: async () => {
          try {
            const created = await api.post(`/classes/${k.id}/students`, { names: names.value });
            data.students.push(...created.map((x) => ({ ...x, artwork_count: 0 })));
            data.students.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
            render();
            toast(`${created.length}명을 추가했어요`, 'ok');
          } catch (ex) {
            toastError(ex);
            return true;
          }
        } },
      ],
    });
    setTimeout(() => names.focus(), 30);
  };
  render();
  root.append(
    h('div', { class: 'stack' },
      h('div', { class: 'row between' },
        h('div', { class: 'muted small' }, `학생 ${data.students.length}명`),
        h('div', { class: 'row nowrap', style: { gap: '8px' } },
          h('a', { class: 'btn', href: `#/t/c/${k.id}/cards` }, glyph('qr', 18), ' 로그인 카드'),
          h('button', { class: 'btn primary', onclick: addStudents }, glyph('plus', 18), ' 학생 추가'),
        ),
      ),
      picCard,
      table,
    ),
  );
}

// ---- 과제 ----
async function assignmentsTab(root, data) {
  const k = data.klass;
  const list = h('div', { class: 'stack' });
  const render = () => {
    clear(list);
    if (!data.assignments.length) {
      list.append(emptyState('assignments', '아직 낸 과제가 없어요', '새 과제를 내면 학생 화면에 바로 나타나요.'));
      return;
    }
    for (const g of data.assignments) {
      const thumb = templateThumbSrc(g.template_ref);
      list.append(
        h('div', { class: 'card row nowrap', style: { alignItems: 'center' } },
          h('div', { style: { width: '96px', height: '72px', borderRadius: '12px', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none', border: '1px solid var(--line)' } },
            thumb ? h('img', { src: thumb, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain', background: '#fff' } }) : glyph(g.technique === 'oil' ? 'oil' : 'water', 30, 1.4)),
          h('div', { class: 'grow' },
            h('h3', { style: { margin: 0 } }, g.title),
            h('div', { class: 'small muted', style: { marginTop: '4px' } },
              [g.status === 'closed' ? '마감' : '진행 중', TECH[g.technique] || '수채화', g.end_at ? `~ ${fmtDate(g.end_at)}` : null].filter(Boolean).join(' · ')),
          ),
          h('div', { class: 'row nowrap', style: { gap: '6px' } },
            h('button', { class: 'btn sm primary', onclick: () => submissionStatus(g, k) }, `제출 ${g.submitted_count}/${data.students.length}`),
            h('div', { class: 'row nowrap', style: { gap: '6px' } },
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
  root.append(h('div', { class: 'row between mb' }, h('a', { class: 'small', href: '#/t/lessons' }, '수업 자료에서 가져오기 ›'), h('button', { class: 'btn primary', onclick: () => newAssignment(k, data, render) }, glyph('plus', 18), ' 새 과제')), list);
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
  const unrev = h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!filters.unreviewed, onchange: (e) => { filters.unreviewed = e.target.checked ? '1' : ''; load(); } }), '피드백 전만');

  async function load() {
    fill(grid, loading());
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    const items = await api.get(`/classes/${k.id}/artworks${qs ? '?' + qs : ''}`);
    clear(grid);
    if (!items.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('gallery', '작품이 없어요')));
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
      h('div', { class: 'corner' }, a.feedback_count ? h('span', { class: 'badge ok', title: '피드백 완료' }, glyph('check', 14, 2.6)) : null),
    ),
    h('div', { class: 'art-meta' },
      h('div', { class: 'art-title' }, a.title),
      h('div', { class: 'art-sub' }, a.student_name || fmtDate(a.submitted_at || a.updated_at)),
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
      list.append(emptyState('psych', '아직 연 마음 탐색이 없어요', '열면 학생 홈에 나타나요 (15~25분).'));
      return;
    }
    for (const c of res.campaigns) {
      const pct = res.studentCount ? Math.round((c.completed / res.studentCount) * 100) : 0;
      list.append(
        h('div', { class: 'card row nowrap' },
          appIcon('psych', 44),
          h('div', { class: 'grow' },
            h('h3', { style: { margin: 0 } }, c.title),
            h('div', { class: 'small muted' }, `${c.status === 'open' ? '진행 중' : '닫힘'} · 참여 ${c.completed}/${res.studentCount}명 (${pct}%)`),
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
      h('div', { class: 'small muted' }, '참고 자료이며 진단이 아니에요. 결과는 선생님만 봐요.'),
      h('button', { class: 'btn primary', onclick: async () => {
        const title = await promptDialog('새 마음 탐색 열기', { label: '제목', value: `${new Date().getMonth() + 1}월 그림 마음 탐색`, okLabel: '열기' });
        if (title == null) return;
        const c = await api.post(`/classes/${k.id}/psych`, { title });
        res.campaigns.unshift({ ...c, completed: 0 });
        render();
        toast('학생 홈 화면에 마음 탐색이 열렸어요', 'ok');
      } }, glyph('plus', 18), ' 새로 열기'),
    ),
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
  const row = (label, sw) => h('label', { class: 'set-line' }, h('span', null, label), sw);
  root.append(
    h('div', { class: 'settings-simple' },
      h('div', { class: 'card stack' },
        h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '학급 이름', name), h('label', { class: 'field' }, '학년/대상', grade)),
        h('button', { class: 'btn primary', onclick: () => save({ name: name.value, grade: grade.value }) }, '저장'),
      ),
      h('div', { class: 'card set-list' },
        row('마음 날씨 체크인', switchInput(!!k.checkin_enabled, (v) => save({ checkin_enabled: v }))),
        row('학생 갤러리보드', switchInput(!!k.gallery_enabled, (v) => save({ gallery_enabled: v }))),
        row(ai.available ? 'AI 도안 · AI 요약' : 'AI 도안 · AI 요약 (서버에 AI 키 없음)', switchInput(!!k.ai_enabled, (v) => save({ ai_enabled: v }, v ? 'AI 기능을 켰어요' : 'AI 기능을 껐어요'))),
      ),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn ghost', onclick: () => save({ archived: !k.archived }, k.archived ? '학급을 다시 열었어요' : '학급을 보관했어요').then(() => go('/t')) }, k.archived ? '보관 해제' : '학급 보관'),
        h('button', { class: 'btn ghost danger', onclick: async () => {
          const typed = await promptDialog('학급 삭제', { label: `학생·작품·검사 결과가 모두 지워져요. 확인을 위해 학급 이름 "${k.name}"을 입력하세요.`, okLabel: '영구 삭제' });
          if (typed == null) return;
          try {
            await api.del(`/classes/${k.id}`, { confirm: typed });
            toast('학급을 삭제했어요');
            go('/t');
          } catch (ex) {
            toastError(ex);
          }
        } }, '학급 삭제'),
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
      h('div', { class: 'no-print' }, h('h1', null, `${k.name} 로그인 카드`), h('p', { class: 'muted' }, `잘라서 나눠 주세요. 아이패드 카메라 앱으로 QR을 비추면 바로 로그인 화면이 열려요. 그림 비밀번호는 우리 반 모두 같아요 (${labelOf(ANIMALS, k.login_animal)} → ${labelOf(FRUITS, k.login_fruit)}).`)),
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
  // 선생님은 이메일로 로그인하므로 비밀번호 바꾸기는 관리자(또는 비밀번호 로그인을 켠 서버)만
  const pwBox = h('div', { hidden: true },
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
  );
  api.get('/auth/config').then((c) => { pwBox.hidden = me.role !== 'admin' && c.teacherEmailOnly; }).catch(() => {});
  return shell(
    h('div', { class: 'page narrow' },
      h('div', { class: 'card pad-lg' },
        h('div', { class: 'row nowrap', style: { gap: '14px', alignItems: 'center' } },
          avatarEl(me, 56),
          h('div', null, h('h1', { style: { margin: 0 } }, me.name), h('div', { class: 'muted' }, me.email), me.school_name ? h('div', { class: 'small muted' }, me.school_name) : null),
        ),
        pwBox,
      ),
    ),
    { wide: '' },
  );
}
