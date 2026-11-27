// 학생: 그림 마음 탐색 진행 (집 → 질문 → 나무 → 질문 → 사람 → 질문 → 마음 날씨 → 완료)
import { api } from '../api.js';
import { h, clear, fill, toast, toastError, confirmDialog } from '../ui.js';
import { go, onLeave, shell } from '../app.js';
import { createStudio } from '../studio/studio.js';
import { PSYCH_STEPS } from '/shared/psych-questions.js';
import { appIcon, glyph, moodIcon, weatherIcon } from '../icons.js';

const SIZES = { landscape: [1600, 1200], portrait: [1200, 1600] };

// 선택지 그림: 기분 → 얼굴, 마음 날씨 → 날씨 그림, 나머지는 글자만
const MOOD_Q = ['t2', 'p2'];
function optIcon(q, o) {
  if (MOOD_Q.includes(q.id)) return h('span', { class: 'o-emoji' }, moodIcon(o.value, 44));
  if (q.id === 's1') return h('span', { class: 'o-emoji' }, weatherIcon(o.value === 'partly' ? 'partly' : o.value, 44));
  return null;
}

export async function psychTest({ params }) {
  const info = await api.get(`/student/psych/${params.id}`);
  const root = h('div');
  const answers = {};
  const drawings = {};
  let studio = null;

  const flow = [];
  flow.push({ type: 'intro' });
  for (const step of PSYCH_STEPS) {
    if (step.orientation) flow.push({ type: 'draw', step });
    flow.push({ type: 'questions', step });
  }
  let idx = 0;

  const leaveGuard = (e) => {
    if (idx > 0 && idx < flow.length) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', leaveGuard);
  onLeave(() => {
    window.removeEventListener('beforeunload', leaveGuard);
    studio?.destroy();
  });

  function stepper(current) {
    return h('div', { class: 'steps' },
      PSYCH_STEPS.map((s) => {
        const pos = flow.findIndex((f) => f.step?.key === s.key);
        const last = flow.map((f) => f.step?.key).lastIndexOf(s.key);
        const cls = idx > last ? 'done' : idx >= pos && idx <= last ? 'on' : '';
        return h('span', { class: `st ${cls}` }, glyph(s.icon, 15, 2), s.title);
      }),
    );
  }

  function show() {
    studio?.destroy();
    studio = null;
    const f = flow[idx];
    clear(root);
    if (!f) return submit();
    if (f.type === 'intro') return intro();
    if (f.type === 'draw') return draw(f.step);
    return questions(f.step);
  }

  function intro() {
    root.append(
      shell(
        h('div', { class: 'page mid' },
          h('div', { class: 'card pad-lg center' },
            appIcon('psych', 72),
            h('h1', null, info.campaign.title),
            h('p', { class: 'muted', style: { fontSize: '1.1rem' } }, '집, 나무, 사람을 차례대로 그리고 몇 가지 질문에 답해요.', h('br'), '잘 그리지 않아도 괜찮아요. 정답은 없어요!'),
            stepper(0),
            h('ul', { class: 'list-clean', style: { maxWidth: '420px', margin: '0 auto', textAlign: 'left' } },
              h('li', null, h('span', { class: 'li-ico' }, glyph('pencil', 18)), '연필이나 크레파스로 천천히 그려요.'),
              h('li', null, h('span', { class: 'li-ico' }, glyph('check', 18)), '틀려도 지우개로 고칠 수 있어요.'),
              h('li', null, h('span', { class: 'li-ico' }, glyph('heart', 18)), '질문에는 떠오르는 대로 솔직하게 골라요.'),
            ),
            h('button', { class: 'btn primary lg mt-lg', onclick: () => { idx++; show(); } }, '시작하기'),
          ),
        ),
        { wide: '' },
      ),
    );
  }

  function draw(step) {
    const [W, H] = SIZES[step.orientation];
    studio = createStudio(root, {
      width: W,
      height: H,
      mode: 'psych',
      title: step.title,
      actions: [
        {
          label: '다 그렸어요',
          icon: glyph('check', 18, 2.4),
          primary: true,
          onClick: async () => {
            if (studio.isEmpty() && !(await confirmDialog('아직 아무것도 그리지 않았어요. 이대로 넘어갈까요?', { okLabel: '넘어가기', title: '확인' }))) return;
            drawings[step.key] = { image: studio.exportPNG(), thumb: studio.thumb(640, 0.88), stats: studio.getStats() };
            idx++;
            show();
          },
        },
      ],
      onExit: async () => {
        if (await confirmDialog('지금 나가면 그린 그림이 사라져요. 그만할까요?', { okLabel: '그만하기', danger: true })) go('/s');
      },
    });
    studio.setHint(step.instruction, 5000);
  }

  function questions(step) {
    const cards = [];
    for (const q of step.questions) {
      const card = h('div', { class: 'q-card' }, h('div', { class: 'q-text' }, q.text));
      if (q.type === 'text') {
        const input = h('input', { class: 'input', placeholder: q.placeholder || '', maxlength: 120, value: answers[q.id] || '', style: { fontSize: '1.1rem' }, oninput: (e) => { answers[q.id] = e.target.value; update(); } });
        card.append(input, h('div', { class: 'tiny faint mt', style: { marginTop: '6px' } }, '쓰기 어려우면 비워 둬도 괜찮아요.'));
      } else {
        const opts = h('div', { class: 'opts' });
        const renderOpts = () => {
          clear(opts);
          for (const o of q.options) {
            const sel = q.type === 'multi' ? (answers[q.id] || []).includes(o.value) : answers[q.id] === o.value;
            opts.append(
              h('button', {
                class: `opt ${sel ? 'on' : ''}`,
                onclick: () => {
                  if (q.type === 'multi') {
                    let cur = answers[q.id] || [];
                    if (o.value === 'alone') cur = cur.includes('alone') ? [] : ['alone'];
                    else cur = cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur.filter((x) => x !== 'alone'), o.value];
                    answers[q.id] = cur;
                  } else answers[q.id] = o.value;
                  renderOpts();
                  update();
                },
              }, optIcon(q, o), o.label),
            );
          }
        };
        renderOpts();
        card.append(opts);
      }
      cards.push(card);
    }
    const thumb = drawings[step.key]?.thumb;
    const next = h('button', { class: 'btn primary lg', onclick: () => { idx++; show(); } }, idx === flow.length - 1 ? '다 했어요! 보내기' : '다음');
    const update = () => {
      next.disabled = !step.questions.every((q) => q.optional || (q.type === 'multi' ? (answers[q.id] || []).length : answers[q.id]));
    };
    update();
    root.append(
      shell(
        h('div', { class: 'page mid' },
          stepper(),
          h('div', { class: 'row nowrap mb' },
            thumb ? h('img', { src: thumb, alt: '', style: { width: '120px', borderRadius: '14px', border: '1px solid var(--line)', background: '#fff' } }) : appIcon(step.key === 'self' ? 'checkin' : 'psych', 64),
            h('div', null, h('h1', { style: { margin: 0 } }, thumb ? `내가 그린 ${step.title.replace(' 그리기', '')}` : step.title), h('p', { class: 'muted', style: { margin: 0 } }, thumb ? '그림을 보면서 질문에 답해 주세요.' : step.instruction)),
          ),
          h('div', { class: 'stack' }, cards),
          h('div', { class: 'row end mt-lg' }, next),
        ),
        { wide: '' },
      ),
    );
  }

  async function submit() {
    root.append(shell(h('div', { class: 'page narrow center' }, h('div', { class: 'card pad-lg mt-lg' }, h('div', { class: 'spinner', style: { margin: '0 auto 12px' } }), h('p', null, '선생님께 보내고 있어요…'))), { wide: '' }));
    try {
      const r = await api.post(`/student/psych/${params.id}/submit`, { answers, drawings });
      window.removeEventListener('beforeunload', leaveGuard);
      done(r.kid);
    } catch (ex) {
      toastError(ex);
      fill(root, 
        shell(h('div', { class: 'page narrow center' }, h('div', { class: 'card pad-lg mt-lg' }, h('h2', null, '보내지 못했어요'), h('p', { class: 'muted' }, ex.message), h('button', { class: 'btn primary', onclick: () => submit() }, '다시 보내기'))), { wide: '' }),
      );
    }
  }

  function done(kid) {
    fill(root, 
      shell(
        h('div', { class: 'page narrow center' },
          h('div', { class: 'card pad-lg mt-lg' },
            h('div', { class: 'celebrate' }, appIcon('submitted', 96)),
            h('h1', null, kid?.headline || '수고했어요!'),
            h('ul', { class: 'list-clean mt', style: { textAlign: 'left', maxWidth: '360px', margin: '16px auto' } }, (kid?.points || []).map((p) => h('li', null, h('span', { class: 'li-ico', style: { color: 'var(--orange)' } }, glyph('star', 18)), p))),
            h('p', { class: 'muted' }, '그림은 선생님께 잘 전달됐어요.'),
            h('a', { class: 'btn primary lg', href: '#/s' }, '홈으로'),
          ),
        ),
        { wide: '' },
      ),
    );
  }

  if (info.done) {
    done(info.kid);
    idx = flow.length;
    return root;
  }
  if (info.campaign.status !== 'open') {
    toast('지금은 참여할 수 없는 검사예요.');
    go('/s');
    return null;
  }
  show();
  return root;
}

