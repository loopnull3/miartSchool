// 드로잉 페이지: 학생(임시저장·제출) / 교사(체험·내려받기)
import { api } from '../api.js';
import { h, toast, toastError, modal, downloadDataUrl } from '../ui.js';
import { go, onLeave, session } from '../app.js';
import { createStudio } from '../studio/studio.js';
import { loadTemplateLayer } from '../templates.js';

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
    title = r.artwork.title;
    size = [r.artwork.width, r.artwork.height];
    draft = r.draft;
    if (r.artwork.assignment_id) assignment = { id: r.artwork.assignment_id };
  }
  if (isStudent && query.assignment) {
    const home = await api.get('/student/home');
    const g = home.assignments.find((x) => x.id === Number(query.assignment));
    if (!g) throw new Error('과제를 찾을 수 없어요. 이미 마감되었을 수 있어요.');
    assignment = g;
    templateRef = templateRef || g.template_ref;
    orientation = g.orientation;
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
    { label: '임시저장', icon: '💾', hideSm: true, onClick: async () => { if (await save(false)) toast('저장했어요. "내 작품"에서 이어 그릴 수 있어요.', 'ok'); } },
    {
      label: assignment ? '제출하기' : '선생님께 보내기',
      icon: '📮',
      primary: true,
      onClick: async () => {
        if (studio.isEmpty()) return toast('아직 그린 게 없어요. 그림을 그려 보세요!');
        modal({
          title: assignment ? '과제를 제출할까요?' : '선생님께 보낼까요?',
          body: h('div', { class: 'center' }, h('img', { src: studio.thumb(480), alt: '', style: { maxHeight: '240px', margin: '0 auto', borderRadius: '12px', border: '1px solid var(--line)' } }), h('p', { class: 'muted mt' }, '보낸 뒤에도 "내 작품"에서 다시 고칠 수 있어요.')),
          actions: [
            { label: '조금 더 그릴래요' },
            { label: '보내기 📮', class: 'primary', onClick: async () => {
              if (await save(true)) {
                toast('선생님께 보냈어요! 🎉', 'ok');
                go('/s/works');
              } else return true;
            } },
          ],
        });
      },
    },
  ];
  const teacherActions = [{ label: '내려받기', icon: '⬇', primary: true, onClick: () => downloadDataUrl(studio.exportPNG(), `${studio.getTitle() || '미아트'}.png`) }];

  studio = createStudio(wrap, {
    width: W,
    height: H,
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
  if (assignment?.description) studio.setHint(`📝 ${assignment.description}`, 6000);
  else if (!draft && templateRef) studio.setHint('🪣 채우기 도구로 톡! 누르면 선 안쪽이 칠해져요', 4000);
  return wrap;
}
