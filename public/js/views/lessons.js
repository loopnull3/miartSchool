// 교사: 수업 자료 라이브러리 → 내 수업으로 저장 → 학급에서 시작하기
import { api } from '../api.js';
import { h, clear, fill, modal, toast, confirmDialog, emptyState } from '../ui.js';
import { shell, go } from '../app.js';
import { lessonCard, lessonArt } from './landing.js';
import { templatePicker } from './templates.js';
import { templateThumbSrc } from '../templates.js';
import { glyph } from '../icons.js';

const PAPERS = [['', '기본'], ['white', '흰 도화지'], ['ivory', '미색 도화지'], ['kraft', '크라프트지'], ['black', '검정 도화지'], ['watercolor', '수채화지'], ['canvas', '캔버스']];
const TECH = { watercolor: '수채화', oil: '유화' };

function tabs(active, myCount) {
  return h('div', { class: 'segmented' },
    h('a', { class: active === 'lib' ? 'on' : '', href: '#/t/lessons' }, '라이브러리'),
    h('a', { class: active === 'my' ? 'on' : '', href: '#/t/lessons/my' }, `내 수업${myCount != null ? ` ${myCount}` : ''}`),
  );
}

const localInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export async function startLessonSheet(myId, defaultTitle) {
  const classes = (await api.get('/classes')).filter((c) => !c.archived);
  if (!classes.length) {
    toast('먼저 학급을 만들어 주세요.');
    return go('/t');
  }
  const classSel = h('select', { class: 'input' }, classes.map((c) => h('option', { value: c.id }, `${c.name} (${c.student_count}명)`)));
  const title = h('input', { class: 'input', maxlength: 60, value: defaultTitle });
  const now = new Date();
  const start = h('input', { class: 'input', type: 'datetime-local', value: localInput(now) });
  const end = h('input', { class: 'input', type: 'datetime-local', value: localInput(new Date(now.getTime() + 7 * 86400_000)) });
  modal({
    title: '수업 시작하기',
    body: h('div', { class: 'stack' },
      h('label', { class: 'field' }, '학급', classSel),
      h('label', { class: 'field' }, '과제 이름', title),
      h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '시작', start), h('label', { class: 'field' }, '마감', end)),
      h('p', { class: 'small faint', style: { margin: 0 } }, '시작 시간이 되면 학생 화면에 과제가 열려요.'),
    ),
    actions: [
      { label: '취소' },
      {
        label: '과제 내기',
        class: 'primary',
        onClick: async () => {
          await api.post(`/my-lessons/${myId}/start`, {
            classId: classSel.value,
            title: title.value,
            startAt: start.value ? new Date(start.value).toISOString() : null,
            endAt: end.value ? new Date(end.value).toISOString() : null,
          });
          toast('학생들에게 과제를 냈어요!', 'ok');
          go(`/t/c/${classSel.value}/assignments`);
        },
      },
    ],
  });
}

function lessonDetail(l, { onSaved } = {}) {
  const meta = [l.grade, l.season, `${l.minutes || 40}분`, TECH[l.technique], ...(l.subjects || [])].filter(Boolean);
  const save = async () => {
    const r = await api.post('/my-lessons', { lessonId: l.id });
    l.saved = true;
    onSaved?.();
    return r.id;
  };
  modal({
    title: l.title,
    wide: true,
    body: h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' } },
      h('div', null,
        h('div', { style: { borderRadius: '18px', overflow: 'hidden' } }, lessonArt(l)),
        h('div', { class: 'lesson-tags mt' }, meta.map((t) => h('span', { class: 'badge' }, t))),
        h('p', { class: 'muted mt', style: { whiteSpace: 'pre-line' } }, l.description || l.summary || ''),
      ),
      h('div', { class: 'stack' },
        l.goals?.length ? h('div', null, h('h3', null, '학습 목표'), h('ul', { class: 'list-clean small' }, l.goals.map((g) => h('li', null, h('span', { class: 'li-ico', style: { color: 'var(--primary)' } }, glyph('check', 16, 2.4)), g)))) : null,
        l.steps?.length ? h('div', null, h('h3', null, '활동 순서'), h('ol', { class: 'steps-list small' }, l.steps.map((s) => h('li', null, s)))) : null,
        l.teacherTips?.length ? h('div', { class: 'notice info' }, h('b', null, '선생님 팁'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, l.teacherTips.map((t) => h('li', null, t)))) : null,
      ),
    ),
    actions: [
      { label: l.saved ? '내 수업에 있어요' : '내 수업으로 저장', onClick: async () => { await save(); toast('내 수업에 저장했어요', 'ok'); } },
      { label: '바로 시작하기', class: 'primary', onClick: async () => { const id = await save(); await startLessonSheet(id, l.title); } },
    ],
  });
}

export async function libraryPage({ query }) {
  const [lessons, my] = await Promise.all([api.get('/lessons'), api.get('/my-lessons')]);
  const f = { grade: '', technique: '', season: '', q: '' };
  const grid = h('div', { class: 'grid' });
  const chipsBox = h('div', { class: 'stack', style: { gap: '10px' } });
  const uniq = (k) => [...new Set(lessons.map((l) => l[k]).filter(Boolean))];
  const chipRow = (key, label, values, fmt = (v) => v) =>
    h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small faint', style: { width: '40px' } }, label),
      h('div', { class: 'chips' }, h('button', { class: `chip ${!f[key] ? 'on' : ''}`, onclick: () => { f[key] = ''; render(); } }, '전체'), values.map((v) => h('button', { class: `chip ${f[key] === v ? 'on' : ''}`, onclick: () => { f[key] = v; render(); } }, fmt(v)))));
  const search = h('input', { class: 'input', type: 'search', placeholder: '수업 검색 (예: 겨울, 대칭, 과학)', style: { maxWidth: '320px' }, oninput: () => { f.q = search.value.trim(); renderGrid(); } });
  function renderGrid() {
    clear(grid);
    const q = f.q.toLowerCase();
    const items = lessons
      .filter((l) => (!f.grade || l.grade === f.grade) && (!f.technique || l.technique === f.technique) && (!f.season || l.season === f.season))
      .filter((l) => !q || [l.title, l.summary, l.description, ...(l.subjects || [])].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    if (!items.length) grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('lessons', '조건에 맞는 수업이 없어요')));
    for (const l of items) grid.append(lessonCard(l, () => lessonDetail(l, { onSaved: renderGrid })));
  }
  function render() {
    fill(chipsBox, 
      chipRow('grade', '학년', uniq('grade')),
      chipRow('technique', '도구', uniq('technique'), (v) => TECH[v] || v),
      chipRow('season', '계절', uniq('season')),
    );
    renderGrid();
  }
  render();
  if (query.open) {
    const l = lessons.find((x) => x.id === query.open);
    if (l) setTimeout(() => lessonDetail(l), 50);
  }
  return shell(
    h('div', null,
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, '수업 자료'), h('p', { class: 'sub' }, '수업안을 골라 내 수업으로 저장하고, 학급에서 바로 시작하세요.')), tabs('lib', my.length)),
      h('div', { class: 'toolbar-row', style: { alignItems: 'flex-start' } }, chipsBox, h('div', { class: 'search' }, search)),
      grid,
    ),
    { active: 'lessons' },
  );
}

function lessonEditor(l, onSaved) {
  const title = h('input', { class: 'input', maxlength: 60, value: l?.title || '' });
  const summary = h('input', { class: 'input', maxlength: 120, value: l?.summary || '', placeholder: '한 줄 소개' });
  const desc = h('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: '학생에게 보여 줄 안내' });
  desc.value = l?.description || '';
  const steps = h('textarea', { class: 'input', rows: 4, placeholder: '활동 순서를 한 줄에 하나씩' });
  steps.value = (l?.steps || []).join('\n');
  let technique = l?.technique || 'watercolor';
  let orientation = l?.orientation || 'landscape';
  let template = l?.template || null;
  const paper = h('select', { class: 'input' }, PAPERS.map(([v, t]) => h('option', { value: v, selected: (l?.paper || '') === v }, t)));
  const techSeg = h('div', { class: 'segmented' });
  const oriSeg = h('div', { class: 'segmented' });
  const tplLabel = h('span', { class: 'small muted' });
  const renderSegs = () => {
    fill(techSeg, ...['watercolor', 'oil'].map((k) => h('button', { class: technique === k ? 'on' : '', onclick: () => { technique = k; renderSegs(); } }, TECH[k])));
    fill(oriSeg, ...[['landscape', '가로'], ['portrait', '세로']].map(([k, t]) => h('button', { class: orientation === k ? 'on' : '', onclick: () => { orientation = k; renderSegs(); } }, t)));
    fill(tplLabel, template ? h('img', { src: templateThumbSrc(template), alt: '', style: { height: '48px', display: 'inline-block', verticalAlign: 'middle', borderRadius: '8px', background: '#fff' } }) : '없음 (자유 그리기)');
  };
  renderSegs();
  const matBox = h('div', { class: 'stack', style: { gap: '8px' } });
  const addMat = (m = {}) => {
    const t = h('input', { class: 'input', placeholder: '자료 이름', value: m.title || '', style: { flex: '1' } });
    const u = h('input', { class: 'input', placeholder: 'https:// (유튜브·이미지·링크)', value: m.url || '', style: { flex: '2' } });
    const row = h('div', { class: 'row nowrap mat-row' }, t, u, h('button', { class: 'btn icon sm ghost', 'aria-label': '자료 삭제', onclick: () => row.remove() }, glyph('close', 16)));
    row._get = () => ({ title: t.value, url: u.value.trim() });
    matBox.append(row);
  };
  (l?.materials || []).forEach(addMat);
  modal({
    title: l?.id ? '수업 편집' : '새 수업 만들기',
    wide: true,
    body: h('div', { class: 'grid two' },
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, '수업 제목', title),
        h('label', { class: 'field' }, '한 줄 소개', summary),
        h('label', { class: 'field' }, '안내', desc),
        h('label', { class: 'field' }, '활동 순서', steps),
      ),
      h('div', { class: 'stack' },
        h('div', { class: 'field' }, '그리기 도구', techSeg),
        h('div', { class: 'field' }, '도화지 방향', oriSeg),
        h('label', { class: 'field' }, '배경지', paper),
        h('div', { class: 'field' }, '스케치 교재 (도안)', h('div', { class: 'row' }, tplLabel, h('button', { class: 'btn sm', onclick: async () => { const r = await templatePicker({ allowNone: true, current: template }); if (r !== undefined) { template = r; renderSegs(); } } }, '고르기'))),
        h('div', { class: 'field' }, '수업 자료 (영상·이미지·링크)', matBox, h('button', { class: 'btn sm', onclick: () => addMat() }, '+ 자료 추가')),
      ),
    ),
    actions: [
      { label: '취소' },
      {
        label: '저장',
        class: 'primary',
        onClick: async () => {
          const data = {
            title: title.value,
            summary: summary.value,
            description: desc.value,
            steps: steps.value.split('\n').map((x) => x.trim()).filter(Boolean),
            technique,
            orientation,
            paper: paper.value || null,
            template,
            materials: [...matBox.querySelectorAll('.mat-row')].map((r) => r._get()).filter((m) => m.url),
          };
          if (l?.id) await api.patch(`/my-lessons/${l.id}`, data);
          else await api.post('/my-lessons', { data });
          toast('저장했어요', 'ok');
          onSaved?.();
        },
      },
    ],
  });
}

export async function myLessonsPage() {
  let my = await api.get('/my-lessons');
  const grid = h('div', { class: 'grid' });
  const reload = async () => {
    my = await api.get('/my-lessons');
    render();
  };
  function render() {
    clear(grid);
    if (!my.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('lessons', '저장한 수업이 없어요', '라이브러리에서 마음에 드는 수업을 저장하거나 직접 만들어 보세요.', h('a', { class: 'btn primary', href: '#/t/lessons' }, '라이브러리 보기'))));
      return;
    }
    for (const l of my) {
      grid.append(
        h('div', { class: 'lesson-card', style: { cursor: 'default' } },
          lessonArt(l),
          h('div', { class: 'lesson-body' },
            h('div', { class: 'lesson-title' }, l.title),
            h('div', { class: 'lesson-sum' }, l.summary || ''),
            h('div', { class: 'lesson-tags' }, h('span', { class: 'badge' }, TECH[l.technique]), l.assignments ? h('span', { class: 'badge ok' }, `${l.assignments}번 진행`) : null, (l.materials || []).length ? h('span', { class: 'badge primary' }, `자료 ${l.materials.length}`) : null),
            h('div', { class: 'row mt', style: { gap: '6px' } },
              h('button', { class: 'btn primary sm', onclick: () => startLessonSheet(l.id, l.title) }, '시작하기'),
              h('button', { class: 'btn sm', onclick: () => lessonEditor(l, reload) }, '편집'),
              h('button', { class: 'btn sm ghost', 'aria-label': '삭제', onclick: async () => { if (await confirmDialog(`'${l.title}'을(를) 내 수업에서 지울까요? 이미 낸 과제는 그대로 남아요.`, { okLabel: '지우기', danger: true })) { await api.del(`/my-lessons/${l.id}`); reload(); } } }, '삭제'),
            ),
          ),
        ),
      );
    }
  }
  render();
  return shell(
    h('div', null,
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, '내 수업'), h('p', { class: 'sub' }, '저장한 수업을 고치고, 학급에서 시작하세요.')), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => lessonEditor(null, reload) }, '+ 직접 만들기'), tabs('my', my.length))),
      grid,
    ),
    { active: 'lessons' },
  );
}
