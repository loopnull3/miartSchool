// 도안 만들기: 기본 도안 · 사진으로 만들기 · AI로 만들기 · 내 도안 / 과제용 도안 선택기
import { api } from '../api.js';
import { h, clear, fill, toast, toastError, modal, confirmDialog, emptyState, loading, debounce } from '../ui.js';
import { go, shell, session } from '../app.js';
import { BUILTIN_TEMPLATES, svgDataUrl, svgToPng, canvasThumb } from '../templates.js';
import { photoToLineArt, fileToImage } from '../photo-sketch.js';

const TABS = [
  ['builtin', '🖼️ 기본 도안'],
  ['photo', '📷 사진으로 만들기'],
  ['ai', '✨ AI로 만들기'],
  ['mine', '📁 내 도안'],
];
const CATEGORIES = ['전체', '동물', '자연', '탈것', '생활', '상상', '패턴'];
const AI_EXAMPLES = ['우주를 나는 고래', '생일 케이크를 든 공룡', '꽃밭의 고양이', '바닷속 성', '로봇 친구', '구름 위 기차'];

export async function templatesPage({ params }) {
  const tab = params.tab || 'builtin';
  const content = h('div');
  const view = shell(
    h('div', null,
      h('h1', null, '도안 만들기'),
      h('p', { class: 'muted' }, session.me.kind === 'student' ? '마음에 드는 도안을 골라 색칠하거나, 사진·AI로 나만의 도안을 만들어요.' : '기본 도안을 쓰거나, 사진·AI로 만든 도안을 저장해 과제에 활용하세요.'),
      h('nav', { class: 'tabs' }, TABS.map(([k, label]) => h('a', { href: `#/templates/${k}`, class: k === tab ? 'active' : '' }, label))),
      content,
    ),
    { active: 'templates' },
  );
  const fn = { builtin: builtinTab, photo: photoTab, ai: aiTab, mine: mineTab }[tab] || builtinTab;
  await fn(content);
  return view;
}

function builtinGrid(onPick, { selected } = {}) {
  let cat = '전체';
  const grid = h('div', { class: 'tpl-grid mt' });
  const chips = h('div', { class: 'chips' });
  const render = () => {
    clear(chips);
    for (const c of CATEGORIES) chips.append(h('button', { class: `chip ${c === cat ? 'active' : ''}`, onclick: () => { cat = c; render(); } }, c));
    clear(grid);
    for (const t of BUILTIN_TEMPLATES.filter((x) => cat === '전체' || x.category === cat)) {
      grid.append(
        h('button', { class: `tpl ${selected === t.id ? 'active' : ''}`, onclick: () => onPick(t) },
          h('div', { class: 'tpl-img' }, h('img', { src: svgDataUrl(t.svg), alt: t.title, loading: 'lazy' })),
          t.title,
        ),
      );
    }
  };
  render();
  return h('div', null, chips, grid);
}

async function builtinTab(root) {
  root.append(
    builtinGrid((t) => {
      modal({
        title: t.title,
        body: h('img', { src: svgDataUrl(t.svg), alt: t.title, style: { width: '100%', background: '#fff', borderRadius: '14px', border: '1px solid var(--line)' } }),
        actions: [{ label: '닫기' }, { label: '🖍️ 이 도안으로 그리기', class: 'primary', onClick: () => go(`/draw?template=${encodeURIComponent(t.id)}`) }],
      });
    }),
  );
}

async function saveTemplate(canvas, title, source) {
  const image = canvas.toDataURL('image/png');
  const thumb = canvasThumb(canvas, 400);
  return api.post('/templates', { title, source, image, thumb });
}

async function photoTab(root) {
  let img = null;
  let result = null;
  const detail = h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': '세밀함' });
  const thick = h('input', { type: 'range', min: 1, max: 5, value: 2, 'aria-label': '선 굵기' });
  const detailVal = h('span', { class: 'num' }, '50');
  const thickVal = h('span', { class: 'num' }, '2');
  const before = h('div', { class: 'sketch-box' }, h('div', { class: 'center muted' }, h('div', { style: { fontSize: '44px' } }, '📷'), '사진을 골라 주세요'));
  const after = h('div', { class: 'sketch-box' }, h('div', { class: 'center muted' }, h('div', { style: { fontSize: '44px' } }, '✏️'), '여기에 도안이 나타나요'));
  const title = h('input', { class: 'input', placeholder: '도안 이름', maxlength: 30, value: '사진 도안' });
  const actions = h('div', { class: 'row hidden' });

  const process = debounce(() => {
    if (!img) return;
    fill(after, h('div', { class: 'spinner' }));
    setTimeout(() => {
      try {
        result = photoToLineArt(img, { detail: Number(detail.value) / 100, thickness: Number(thick.value) });
        fill(after, result);
        actions.classList.remove('hidden');
      } catch (ex) {
        toastError(ex);
      }
    }, 20);
  }, 200);

  const file = h('input', {
    type: 'file', accept: 'image/*', class: 'hidden',
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        img = await fileToImage(f);
        const c = document.createElement('canvas');
        const s = Math.min(1, 800 / Math.max(img.width, img.height));
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        fill(before, c);
        title.value = f.name.replace(/\.[^.]+$/, '').slice(0, 30) || '사진 도안';
        process();
      } catch (ex) {
        toastError(ex);
      }
    },
  });
  detail.addEventListener('input', () => { detailVal.textContent = detail.value; process(); });
  thick.addEventListener('input', () => { thickVal.textContent = thick.value; process(); });

  const save = async (andDraw) => {
    if (!result) return;
    try {
      const t = await saveTemplate(result, title.value || '사진 도안', 'photo');
      toast('내 도안에 저장했어요', 'ok');
      if (andDraw) go(`/draw?template=${encodeURIComponent(t.ref)}`);
    } catch (ex) {
      toastError(ex);
    }
  };
  actions.append(
    h('div', { style: { minWidth: '200px', flex: '1' } }, title),
    h('button', { class: 'btn', onclick: () => save(false) }, '💾 내 도안에 저장'),
    h('button', { class: 'btn primary', onclick: () => save(true) }, '🖍️ 저장하고 그리기'),
  );

  root.append(
    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', null, h('h2', { style: { margin: 0 } }, '사진을 색칠 도안으로'), h('p', { class: 'small muted', style: { margin: 0 } }, '사진은 서버로 보내지 않고 이 기기 안에서 바로 바꿔요. 배경이 단순하고 밝은 사진일수록 깔끔해요.')),
        h('button', { class: 'btn primary lg', onclick: () => file.click() }, '📷 사진 고르기 / 찍기'),
        file,
      ),
      h('div', { class: 'sketch-split mt' }, before, after),
      h('div', { class: 'stack mt' },
        h('div', { class: 'range-row' }, h('span', null, '세밀함'), detail, detailVal),
        h('div', { class: 'range-row' }, h('span', null, '선 굵기'), thick, thickVal),
      ),
      h('div', { class: 'mt' }, actions),
    ),
  );
}

async function aiTab(root) {
  const status = await api.get('/ai/status');
  const prompt = h('textarea', { class: 'input', rows: 2, maxlength: 200, placeholder: '어떤 그림을 색칠하고 싶나요? 예) 우주를 나는 고래' });
  const out = h('div', { class: 'mt' });
  let current = null;
  const title = h('input', { class: 'input', maxlength: 30 });

  const showSuggestions = (ids, msg) => {
    const items = BUILTIN_TEMPLATES.filter((t) => ids?.includes(t.id));
    fill(out, 
      h('div', { class: 'notice warn' }, msg),
      items.length
        ? h('div', { class: 'mt' }, h('h3', null, '비슷한 기본 도안'), h('div', { class: 'tpl-grid' }, items.map((t) => h('button', { class: 'tpl', onclick: () => go(`/draw?template=${encodeURIComponent(t.id)}`) }, h('div', { class: 'tpl-img' }, h('img', { src: svgDataUrl(t.svg), alt: t.title })), t.title))))
        : null,
    );
  };

  const generate = async () => {
    const text = prompt.value.trim();
    if (!text) return toast('어떤 그림을 원하는지 적어 주세요.');
    genBtn.disabled = true;
    fill(out, h('div', { class: 'card center' }, h('div', { class: 'spinner', style: { margin: '10px auto' } }), h('p', { class: 'muted' }, 'AI가 도안을 그리고 있어요… (30초~1분 정도 걸려요)')));
    try {
      const r = await api.post('/ai/sketch', { prompt: text });
      current = r;
      title.value = r.title;
      fill(out, 
        h('div', { class: 'card' },
          h('img', { src: svgDataUrl(r.svg), alt: r.title, style: { width: '100%', maxWidth: '720px', margin: '0 auto', background: '#fff', borderRadius: '14px', border: '1px solid var(--line)' } }),
          h('div', { class: 'row mt' },
            h('div', { style: { minWidth: '200px', flex: '1' } }, title),
            h('button', { class: 'btn', onclick: generate }, '🔄 다시 만들기'),
            h('button', { class: 'btn', onclick: () => save(false) }, '💾 내 도안에 저장'),
            h('button', { class: 'btn primary', onclick: () => save(true) }, '🖍️ 저장하고 그리기'),
          ),
        ),
      );
    } catch (ex) {
      if (ex.data?.suggestions) showSuggestions(ex.data.suggestions, ex.message);
      else fill(out, h('div', { class: 'notice danger' }, ex.message));
    } finally {
      genBtn.disabled = false;
    }
  };
  const save = async (andDraw) => {
    if (!current) return;
    try {
      const canvas = await svgToPng(current.svg, 1600, 1200);
      const t = await saveTemplate(canvas, title.value || current.title, 'ai');
      toast('내 도안에 저장했어요', 'ok');
      if (andDraw) go(`/draw?template=${encodeURIComponent(t.ref)}`);
    } catch (ex) {
      toastError(ex);
    }
  };
  const genBtn = h('button', { class: 'btn primary lg', onclick: generate }, '✨ 도안 만들기');
  root.append(
    h('div', { class: 'card' },
      h('h2', null, '말로 설명하면 AI가 색칠 도안을 그려요'),
      status.enabled ? null : h('div', { class: 'notice warn mb' }, status.available ? '선생님이 이 학급의 AI 기능을 꺼 두었어요.' : 'AI 기능이 아직 설정되지 않았어요. 기본 도안이나 사진 도안을 이용해 주세요.'),
      prompt,
      h('div', { class: 'chips mt' }, AI_EXAMPLES.map((e) => h('button', { class: 'chip', onclick: () => { prompt.value = e; } }, e))),
      h('div', { class: 'row end mt' }, genBtn),
    ),
    out,
  );
  genBtn.disabled = !status.enabled;
}

async function mineTab(root) {
  const list = await api.get('/templates');
  const grid = h('div', { class: 'tpl-grid' });
  const render = () => {
    clear(grid);
    if (!list.length) {
      grid.append(h('div', { style: { gridColumn: '1 / -1' } }, emptyState('📁', '저장한 도안이 없어요', '사진이나 AI로 도안을 만들어 저장해 보세요.')));
      return;
    }
    for (const t of list) {
      grid.append(
        h('div', { class: 'tpl' },
          h('button', { class: 'tpl-img', style: { border: 'none', cursor: 'pointer', padding: 0 }, onclick: () => go(`/draw?template=${encodeURIComponent(t.ref)}`) }, h('img', { src: `/api/templates/${t.id}/image?thumb=1`, alt: t.title, loading: 'lazy' })),
          h('div', null, t.source === 'ai' ? '✨ ' : t.source === 'photo' ? '📷 ' : '', t.title),
          t.mine
            ? h('button', { class: 'btn sm ghost', onclick: async () => {
                if (!(await confirmDialog(`'${t.title}' 도안을 지울까요?`, { okLabel: '지우기', danger: true }))) return;
                await api.del(`/templates/${t.id}`);
                list.splice(list.indexOf(t), 1);
                render();
              } }, '지우기')
            : h('span', { class: 'tiny faint' }, '선생님 도안'),
        ),
      );
    }
  };
  render();
  root.append(grid);
}

// 과제용 도안 선택기 → ref | null(도안 없음) | undefined(취소)
export function templatePicker({ allowNone = true, current = null } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      done = true;
      resolve(v);
      m.close();
    };
    const body = h('div');
    const tabs = h('div', { class: 'chips mb' });
    let tab = 'builtin';
    const area = h('div');
    const render = async () => {
      clear(tabs);
      for (const [k, label] of [['builtin', '기본 도안'], ['mine', '내 도안']]) tabs.append(h('button', { class: `chip ${tab === k ? 'active' : ''}`, onclick: () => { tab = k; render(); } }, label));
      if (allowNone) tabs.append(h('button', { class: `chip ${current === null ? 'active' : ''}`, onclick: () => finish(null) }, '도안 없음'));
      clear(area);
      if (tab === 'builtin') area.append(builtinGrid((t) => finish(t.id), { selected: current }));
      else {
        area.append(loading());
        try {
          const list = await api.get('/templates');
          fill(area, 
            list.length
              ? h('div', { class: 'tpl-grid' }, list.map((t) => h('button', { class: `tpl ${current === t.ref ? 'active' : ''}`, onclick: () => finish(t.ref) }, h('div', { class: 'tpl-img' }, h('img', { src: `/api/templates/${t.id}/image?thumb=1`, alt: t.title })), t.title)))
              : emptyState('📁', '저장한 도안이 없어요', '"도안 만들기" 메뉴에서 사진이나 AI로 도안을 만들 수 있어요.'),
          );
        } catch (ex) {
          toastError(ex);
        }
      }
    };
    body.append(tabs, area);
    const m = modal({ title: '도안 고르기', body, wide: true, onClose: () => !done && resolve(undefined) });
    render();
  });
}
