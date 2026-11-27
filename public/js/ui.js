import { appIcon, glyph } from './icons.js';
// DOM 헬퍼 · 토스트 · 모달
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// 비우고 다시 채우기 (null·false는 건너뛰고 배열은 펼친다)
export function fill(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

export function toast(message, kind = '') {
  const root = document.getElementById('toast-root');
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  root.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 4200 : 2600);
}

export function toastError(err) {
  toast(err?.message || String(err), 'error');
}

export function modal({ title, body, wide = false, actions = [], onClose } = {}) {
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  const actionEls = actions.map((a) =>
    h('button', { class: `btn ${a.class || ''}`, type: 'button', onclick: async (e) => {
      if (a.onClick) {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const keep = await a.onClick(close);
          if (keep !== true && a.close !== false) close();
        } catch (err) {
          toastError(err);
        } finally {
          btn.disabled = false;
        }
      } else close();
    } }, a.label),
  );
  const box = h(
    'div',
    { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' }, h('h2', null, title || ''), h('button', { class: 'modal-close', type: 'button', 'aria-label': '닫기', onclick: close }, glyph('close', 16, 2.2))),
    body,
    actionEls.length ? h('div', { class: 'row end mt' }, actionEls) : null,
  );
  const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() }, box);
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  return { close, box };
}

export function confirmDialog(message, { okLabel = '확인', danger = false, title = '확인' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title,
      body: h('p', { class: 'muted' }, message),
      actions: [
        { label: '취소', onClick: () => { answered = true; resolve(false); } },
        { label: okLabel, class: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } },
      ],
      onClose: () => !answered && resolve(false),
    });
  });
}

export function promptDialog(title, { label = '', value = '', placeholder = '', okLabel = '확인' } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', value, placeholder });
    let done = false;
    const m = modal({
      title,
      body: h('label', { class: 'field' }, label, input),
      actions: [
        { label: '취소', onClick: () => { done = true; resolve(null); } },
        { label: okLabel, class: 'primary', onClick: () => { done = true; resolve(input.value.trim()); } },
      ],
      onClose: () => !done && resolve(null),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        done = true;
        resolve(input.value.trim());
        m.close();
      }
    });
    setTimeout(() => input.focus(), 30);
  });
}

export function loading() {
  return h('div', { class: 'loading' }, h('div', { class: 'spinner' }));
}

export function emptyState(iconName, title, sub, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-emoji' }, appIcon(iconName || 'works', 60)), h('h3', null, title), sub ? h('p', { class: 'muted' }, sub) : null, action || null);
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function fmtDateTime(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function switchInput(checked, onChange) {
  const input = h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch' }, input, h('span'));
}

export function stampEl(text, sm = false) {
  return h('span', { class: `stamp ${sm ? 'sm' : ''}` }, text);
}

export function downloadDataUrl(dataUrl, filename) {
  const a = h('a', { href: dataUrl, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// SF Symbols 느낌의 작은 아이콘
const ICONS = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>',
  left: '<path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  right: '<path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
export function icon(name, size = 18) {
  const span = document.createElement('span');
  span.style.display = 'inline-grid';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span;
}
