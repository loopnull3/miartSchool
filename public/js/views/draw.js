// 드로잉 페이지: 학생(임시저장·제출) / 교사(체험·내려받기)
import { api } from '../api.js';
import { h, toast, toastError, modal, downloadDataUrl } from '../ui.js';
import { go, onLeave, session } from '../app.js';
import { createStudio } from '../studio/studio.js';
import { loadTemplateLayer } from '../templates.js';
import { glyph } from '../icons.js';

const SIZES = { landscape: [1600, 1200], portrait: [1200, 1600] };

export async function drawPage({ query }) {
  const isStudent = session.me.kind === 'student';
  let artworkId = query.artwork ? Number(query.artwork) : null;
  let assignment = null;
  let templateRef = query.template || null;
  let orientation = query.orientation === 'portrait' ? 'portrait' : 'landscape';
  let title = '';
  let draft = null;
  let size = null;

  if (isStudent && artworkId) {
    const r = await api.get(`/artworks/${artworkId}/draft`);
    templateRef = r.artwork.template_ref;
    query.technique = r.artwork.technique;
    title = r.artwork.title;
    size = [r.artwork.width, r.artwork.height];
    draft = r.draft;
    if (r.artwork.assignment_id) assignment = { id: r.artwork.assignment_id };
  }
  let technique = query.technique === 'oil' ? 'oil' : 'watercolor';
  if (isStudent && (query.assignment || assignment?.id)) {
    const g = await api.get(`/student/assignments/${query.assignment || assignment.id}`).catch((e) => {
      if (query.assignment) throw e;
      return null;
    });
    assignment = g;
  }
  if (assignment) {
    const g = assignment;
    templateRef = templateRef || g.template_ref;
    if (!size) orientation = g.orientation;
    technique = g.technique || technique;
    title = title || g.title;
  }
  const [W, H] = size || SIZES[orientation];

  const wrap = h('div');
  let studio;
  let saving = false;

  async function save(submit) {
    if (saving) return false;
    saving = true;
    try {
      const payload = {
        title: studio.getTitle() || title || '내 그림',
        width: W,
        height: H,
        templateRef,
        technique: studio.getTechnique?.() || technique,
        assignmentId: assignment?.id ?? null,
        image: studio.exportPNG(),
        thumb: studio.thumb(480),
        draft: studio.getDraft(),
        stats: studio.getStats(),
        submit,
      };
      const r = artworkId ? await api.put(`/artworks/${artworkId}`, payload) : await api.post('/artworks', payload);
      artworkId = r.id;
      studio.markClean();
      return true;
    } catch (ex) {
      toastError(ex);
      return false;
    } finally {
      saving = false;
    }
  }

  const studentActions = [
    { label: '임시저장', icon: glyph('download', 18), hideSm: true, onClick: async () => { if (await save(false)) toast('저장했어요. "내 작품"에서 이어 그릴 수 있어요.', 'ok'); } },
    {
      label: assignment ? '제출하기' : '선생님께 보내기',
      icon: glyph('send', 18),
      primary: true,
      onClick: async () => {
        if (assignment?.closed) return toast('마감된 과제예요. 임시저장은 할 수 있어요.');
        if (studio.isEmpty()) return toast('아직 그린 게 없어요. 그림을 그려 보세요!');
        modal({
          title: assignment ? '과제를 제출할까요?' : '선생님께 보낼까요?',
          body: h('div', { class: 'center' }, h('img', { src: studio.thumb(480), alt: '', style: { maxHeight: '240px', margin: '0 auto', borderRadius: '12px', border: '1px solid var(--line)' } }), h('p', { class: 'muted mt' }, '보낸 뒤에도 "내 작품"에서 다시 고칠 수 있어요.')),
          actions: [
            { label: '조금 더 그릴래요' },
            { label: '보내기', class: 'primary', onClick: async () => {
              if (await save(true)) {
                toast('선생님께 보냈어요!', 'ok');
                go('/s/works');
              } else return true;
            } },
          ],
        });
      },
    },
  ];
  const teacherActions = [{ label: '내려받기', icon: glyph('download', 18), primary: true, onClick: () => downloadDataUrl(studio.exportPNG(), `${studio.getTitle() || '미아트'}.png`) }];

  const guide = assignment ? { title: assignment.title, description: assignment.description || '', steps: assignment.steps || [] } : null;
  studio = createStudio(wrap, {
    width: W,
    height: H,
    technique,
    // 과제는 선생님이 정한 도구(수채화/유화)로 고정, 자유 그림은 설정에서 바꿀 수 있다
    lockTechnique: !!assignment,
    paper: assignment?.paper || undefined,
    guide: guide && (guide.description || guide.steps.length) ? guide : null,
    materials: assignment?.materials || [],
    title: title || (isStudent ? '' : '드로잉 체험'),
    titleEditable: isStudent,
    actions: isStudent ? studentActions : teacherActions,
    onExit: async () => {
      if (!studio.isDirty() || !isStudent) return go(isStudent ? '/s' : '/t');
      modal({
        title: '저장하지 않은 그림이 있어요',
        body: h('p', { class: 'muted' }, '임시저장하면 "내 작품"에서 이어 그릴 수 있어요.'),
        actions: [
          { label: '저장 안 하고 나가기', class: 'danger', onClick: () => { studio.markClean(); go('/s'); } },
          { label: '저장하고 나가기', class: 'primary', onClick: async () => { if (await save(false)) go('/s/works'); else return true; } },
        ],
      });
    },
  });

  const beforeUnload = (e) => {
    if (studio.isDirty() && isStudent) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  onLeave(() => {
    window.removeEventListener('beforeunload', beforeUnload);
    studio.destroy();
  });

  if (templateRef) {
    loadTemplateLayer(templateRef, W, H)
      .then((t) => t && studio.setTemplate(t.canvas))
      .catch(() => toast('도안을 불러오지 못했어요.', 'error'));
  }
  if (draft) await studio.loadDraft(draft);
  if (assignment?.closed) studio.setHint('마감된 과제예요', 4000);
  else if (assignment?.description) studio.setHint(assignment.description.split('\n')[0], 6000);
  else if (!draft && templateRef) studio.setHint('페인트 채우기로 톡! 누르면 선 안쪽이 칠해져요', 4000);
  return wrap;
}

// 공개 체험: 로그인 없이 수채화 / 유화 도구 써 보기 (저장 없음)
export async function tryPage({ params, query }) {
  const technique = params.technique === 'oil' ? 'oil' : 'watercolor';
  const wrap = h('div');
  const studio = createStudio(wrap, {
    width: 1600,
    height: 1200,
    technique,
    title: technique === 'oil' ? '유화 체험' : '수채화 체험',
    guide: {
      title: technique === 'oil' ? '유화 체험' : '수채화 체험',
      description: '설치나 가입 없이 바로 그려 보세요. 체험 그림은 저장되지 않아요. 마음에 들면 내려받을 수 있어요.',
      steps: technique === 'oil'
        ? ['유화 붓 호수(1~6호)를 바꿔 가며 칠해 보세요.', '스머지로 물감을 문질러 섞어 보세요.', '헝겊으로 살살 닦아 내면 물감이 옅어져요.']
        : ['수채화 붓으로 겹쳐 칠하면 색이 진해져요.', '넓은 수채화 붓으로 하늘을 칠해 보세요.', '꽃 브러시로 꽃길을 그려 보세요.'],
    },
    actions: [
      { label: '내려받기', icon: glyph('download', 18), hideSm: true, onClick: () => downloadDataUrl(studio.exportPNG(), `미아트스쿨-${technique}.png`) },
      { label: '무료로 시작하기', primary: true, onClick: () => go('/register') },
    ],
    onExit: () => go('/'),
  });
  onLeave(() => studio.destroy());
  if (query.template) {
    loadTemplateLayer(query.template, 1600, 1200).then((t) => t && studio.setTemplate(t.canvas)).catch(() => {});
  }
  studio.setHint('체험 그림은 저장되지 않아요', 3500);
  return wrap;
}
