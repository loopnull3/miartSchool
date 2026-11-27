// 드로잉 스튜디오: 수채화/유화 기법 · 레이어 · 브러시 · 채우기 · 도장 · 올가미 · 스포이드 · 배경지
// · 수업 자료 · 확대/이동 · 실행 취소 · 드로잉 통계
import { h, clear, toast, confirmDialog, switchInput } from '../ui.js';
import { BRUSHES, OIL_PRESETS, StrokeRenderer, textureCanvas, makeSampler, renderBrushSample, wetEdge } from './brushes.js';
import { floodFill } from './fill.js';
import { History } from './history.js';
import { PALETTE, PSYCH_PALETTE, hexToRgb, rgbToHex, classifyColor, hsl } from './color.js';
import { PAPERS, PAPER_ORDER, isPaper, drawPaper, paperPreview } from './paper.js';
import { icon, toolIcon, techIcon, iconNameFor, stripEmoji } from './icons.js';
import { buildMaterialsBody, hasLessonContent } from './materials.js';
import { STAMP_SHAPES, STAMP_ORDER, drawStamp, stampSvg } from './stamps.js';
const TOOL_META = {
  fill: { label: '페인트 채우기', short: '채우기' },
  stamp: { label: '도장' },
  lasso: { label: '올가미' },
  picker: { label: '스포이드' },
  hand: { label: '이동' },
};
export const TECHNIQUES = {
  watercolor: {
    label: '수채화',
    paper: 'white',
    tools: ['pencil', 'crayon', 'pen', 'marker', 'watercolor', 'watercolorWide', 'flower', 'spray', 'rainbow', '|', 'fill', 'stamp', 'lasso', 'picker', 'eraser', 'hand'],
  },
  oil: { label: '유화', paper: 'canvas', tools: ['oil', 'smudge', 'rag', '|', 'fill', 'lasso', 'picker', 'hand'] },
};
const PSYCH_TOOLS = ['pencil', 'crayon', 'pen', 'eraser', 'hand'];
const TAP_TOOLS = new Set(['fill', 'picker', 'stamp']);
const MAX_LAYERS = 6;
const ZOOM_HINT_KEY = 'miart.studio.zoomResetHint';
const ZOOM_HINT = '두 손가락으로 두 번 톡 하면 원래 크기로 돌아와요';
const SVG_NS = 'http://www.w3.org/2000/svg';

function meta(t) {
  const m = BRUSHES[t] || TOOL_META[t] || { label: t };
  return { label: m.label, short: m.short || m.label };
}

function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 사생활 보호 모드 등 */
  }
}

export function createStudio(root, opts = {}) {
  const W = opts.width || 1600;
  const H = opts.height || 1200;
  const mode = opts.mode === 'psych' ? 'psych' : 'full';
  const psych = mode === 'psych';
  const palette = psych ? PSYCH_PALETTE : PALETTE;
  const wideMQ = window.matchMedia('(min-width: 1100px)');
  let technique = !psych && TECHNIQUES[opts.technique] ? opts.technique : 'watercolor';
  let guide = opts.guide || null;
  let materials = Array.isArray(opts.materials) ? opts.materials : [];

  const state = {
    tool: 'pencil',
    color: '#222222',
    sizes: Object.fromEntries(Object.entries(BRUSHES).map(([k, b]) => [k, b.size])),
    opacity: Object.fromEntries(Object.entries(BRUSHES).map(([k, b]) => [k, b.opacity])),
    strength: { smudge: BRUSHES.smudge.strength, rag: BRUSHES.rag.strength },
    stamp: 'star',
    pressure: true,
    palmReject: true,
    penOnly: !!opts.penOnly,
    scale: 1,
    tx: 0,
    ty: 0,
    autoFit: true,
    recent: [],
    paper: isPaper(opts.paper) ? opts.paper : psych ? 'white' : TECHNIQUES[technique].paper,
    paperAuto: !isPaper(opts.paper),
    tab: 'brush',
    panelOpen: wideMQ.matches,
    lastBrush: null,
  };
  state.sizes.stamp = 110;

  const stats = {
    startedAt: Date.now(),
    activeMs: 0,
    lastEnd: 0,
    strokeCount: 0,
    eraseCount: 0,
    undoCount: 0,
    fillCount: 0,
    stampCount: 0,
    colors: new Set(),
    dark: 0,
    warm: 0,
    cool: 0,
    colored: 0,
    pressureSum: 0,
    pressureN: 0,
    tools: {},
  };

  let dirty = false;
  const history = new History();
  const renderer = new StrokeRenderer();
  const layers = [];
  let active = 0;
  let layerSeq = 0;
  let templateCanvas = null;
  let templateBarrier = null;
  let destroyed = false;

  // ---------- DOM: 캔버스 ----------
  function canvasEl(w, hh) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    return c;
  }
  const svgEl = (tag, attrs = {}) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  const viewport = h('div', { class: 'viewport' });
  const stage = h('div', { class: 'stage', style: { width: `${W}px`, height: `${H}px` } });
  const paperCanvas = canvasEl(W, H);
  paperCanvas.className = 'paper-layer';
  const paperCtx = paperCanvas.getContext('2d');
  // 현재 레이어 + 미리보기 + 떠 있는 선택 영역을 한 묶음으로 격리해 '곱하기' 미리보기가 결과와 같게 보이게 한다
  const group = h('div', { class: 'active-group' });
  const preview = canvasEl(W, H);
  preview.className = 'preview-layer';
  const previewCtx = preview.getContext('2d');
  const solid = canvasEl(W, H);
  const solidCtx = solid.getContext('2d');
  const tplEl = canvasEl(W, H);
  tplEl.className = 'template-layer';
  tplEl.style.display = 'none';
  const selSvg = svgEl('svg', { class: 'sel-outline', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
  const selG = svgEl('g');
  const antsBg = svgEl('path', { class: 'ants-bg' });
  const ants = svgEl('path', { class: 'ants' });
  selG.append(antsBg, ants);
  selSvg.append(selG);
  group.append(preview);
  stage.append(paperCanvas, group, tplEl, selSvg);
  const cursor = h('div', { class: 'brush-cursor' });
  viewport.append(stage, cursor);
  let backup = null;
  let backupCtx = null;
  function ensureBackup() {
    if (!backup) {
      backup = canvasEl(W, H);
      backupCtx = backup.getContext('2d');
    }
    return backupCtx;
  }

  // ---------- DOM: 위쪽 막대 ----------
  const iconBtn = (name, label, onClick, cls = '') => h('button', { class: `s-btn ${cls}`, type: 'button', title: label, 'aria-label': label, onclick: onClick }, icon(name));
  const undoBtn = iconBtn('undo', '실행 취소', () => undo());
  const redoBtn = iconBtn('redo', '다시 실행', () => redo());
  const zoomLabel = h('button', { class: 's-zoom', type: 'button', title: '화면에 맞추기', 'aria-label': '화면에 맞추기', onclick: () => fit(true) }, '100%');
  const titleInput = opts.titleEditable
    ? h('input', { class: 's-title-input', value: opts.title || '', maxlength: 40, placeholder: '그림 제목', 'aria-label': '그림 제목', oninput: () => (dirty = true) })
    : h('span', { class: 's-title' }, stripEmoji(opts.title || ''));
  const materialsBtn = h('button', { class: 's-btn s-pill materials-btn', type: 'button', title: '수업 자료', 'aria-label': '수업 자료', onclick: () => toggleSheet() }, icon('materials'), h('span', { class: 'lbl' }, '수업 자료'));
  const layersBtn = psych ? null : iconBtn('layers', '레이어', () => openPanel('layers', true), 'hide-phone');
  const settingsBtn = iconBtn('settings', '설정', () => openPanel('settings', true), 'hide-phone');
  const actionsEl = h('div', { class: 's-actions' });
  for (const a of opts.actions || []) {
    // 아이콘: DOM 노드(예: glyph('send', 18)) · 선 아이콘 이름('save' · 'send' · 'check' · 'download' …).
    // 그림 문자로 넘어오면 같은 뜻의 선 아이콘으로 바꾸고, 모르는 그림 문자는 보여 주지 않는다
    let ico = null;
    if (a.icon instanceof Node) ico = h('span', { class: 'ico', 'aria-hidden': 'true' }, a.icon);
    else if (iconNameFor(a.icon)) ico = icon(iconNameFor(a.icon), 18);
    const label = stripEmoji(a.label);
    actionsEl.append(
      h('button', { class: `btn s-action ${a.primary ? 'primary' : ''} ${a.hideSm ? 'hide-sm' : ''}`, type: 'button', title: label, 'aria-label': label, onclick: () => a.onClick(api) },
        ico,
        h('span', { class: 'a-lbl' }, label)),
    );
  }
  const top = h(
    'header',
    { class: 'studio-top' },
    h('div', { class: 's-left' }, iconBtn('back', '나가기', () => opts.onExit?.(api), 'back-btn'), titleInput),
    h('div', { class: 's-right' },
      h('div', { class: 's-group' }, undoBtn, redoBtn),
      h('div', { class: 's-group zoom-group' }, iconBtn('zoomOut', '축소', () => zoomCenter(1 / 1.25), 'hide-narrow'), zoomLabel, iconBtn('zoomIn', '확대', () => zoomCenter(1.25), 'hide-narrow')),
      h('div', { class: 's-group' }, materialsBtn, layersBtn, settingsBtn),
      actionsEl,
    ),
  );

  // ---------- DOM: 도구 팔레트 · 속성 패널 · 시트 ----------
  const toolsEl = h('div', { class: 'tp-tools', role: 'toolbar', 'aria-label': '그리기 도구' });
  const colorWell = h('button', { class: 'color-well', type: 'button', title: '색 · 굵기', 'aria-label': '색과 굵기 패널 열기', onclick: () => openPanel('brush', true) }, h('span', { class: 'cw-inner' }));
  const paletteEl = h('nav', { class: 'tool-palette' }, toolsEl, colorWell);
  const toolButtons = {};

  const tabsEl = h('div', { class: 'seg insp-tabs', role: 'tablist' });
  const inspBody = h('div', { class: 'insp-body' });
  const inspector = h('aside', { class: 'inspector', 'aria-label': '속성 패널' },
    h('div', { class: 'insp-head' }, psych ? h('strong', { class: 'insp-title' }, '색과 굵기') : tabsEl,
      h('button', { class: 's-btn sm insp-close', type: 'button', title: '닫기', 'aria-label': '패널 닫기', onclick: () => setPanelOpen(false) }, icon('close', 18))),
    inspBody,
  );

  const sheetBody = h('div', { class: 'sheet-scroll' });
  const sheet = h('aside', { class: 'sheet', 'aria-label': '수업 자료', 'aria-hidden': 'true' },
    h('div', { class: 'sheet-head' }, h('h3', null, icon('materials', 20), '수업 자료'), h('button', { class: 's-btn sm', type: 'button', title: '닫기', 'aria-label': '수업 자료 닫기', onclick: () => toggleSheet(false) }, icon('close', 18))),
    sheetBody,
  );
  let sheetBuilt = false;

  const hintEl = h('div', { class: 'studio-hint hidden', role: 'status' });
  const selBar = h('div', { class: 'sel-bar hidden' },
    h('span', { class: 'sel-text' }, '선택한 곳을 끌어서 옮겨요'),
    h('button', { class: 'sel-btn', type: 'button', onclick: () => cancelSelection() }, '취소'),
    h('button', { class: 'sel-btn primary', type: 'button', onclick: () => commitSelection() }, icon('check', 18), '완료'),
  );

  const el = h('div', { class: 'studio', 'data-mode': mode }, viewport, top, paletteEl, inspector, sheet, hintEl, selBar);
  root.append(el);

  // ---------- 레이어 ----------
  function addLayer(name, { select = true } = {}) {
    if (layers.length >= MAX_LAYERS) {
      toast(`레이어는 ${MAX_LAYERS}개까지 만들 수 있어요.`);
      return null;
    }
    const canvas = canvasEl(W, H);
    const layer = { id: ++layerSeq, name: name || `레이어 ${layerSeq}`, canvas, ctx: canvas.getContext('2d'), visible: true, touched: false, thumb: canvasEl(104, 78) };
    layers.splice(layers.length ? active + 1 : 0, 0, layer);
    stage.insertBefore(canvas, group);
    if (select) active = layers.indexOf(layer);
    restack();
    renderPanel();
    return layer;
  }

  function restack() {
    layers.forEach((l, i) => {
      const z = 10 + i * 2;
      if (i === active) {
        group.style.zIndex = String(z);
        if (l.canvas.parentNode !== group) group.insertBefore(l.canvas, group.firstChild);
        l.canvas.style.zIndex = '1';
      } else {
        if (l.canvas.parentNode !== stage) stage.insertBefore(l.canvas, group);
        l.canvas.style.zIndex = String(z);
      }
      l.canvas.style.display = l.visible ? '' : 'none';
    });
  }

  function updateThumb(layer) {
    const t = layer.thumb.getContext('2d');
    t.clearRect(0, 0, layer.thumb.width, layer.thumb.height);
    drawLayer(t, layer, layer.thumb.width, layer.thumb.height);
  }

  // 레이어 하나(떠 있는 선택 영역 포함)를 ctx에 그린다
  function drawLayer(ctx, l, w = W, hh = H) {
    ctx.drawImage(l.canvas, 0, 0, w, hh);
    if (sel && sel.layer === l) {
      const sx = w / W;
      const sy = hh / H;
      ctx.drawImage(sel.canvas, (sel.rect.x + sel.dx) * sx, (sel.rect.y + sel.dy) * sy, sel.rect.w * sx, sel.rect.h * sy);
    }
  }

  function drawLayers(ctx, w = W, hh = H) {
    for (const l of layers) if (l.visible) drawLayer(ctx, l, w, hh);
  }

  // ---------- 좌표 · 확대 ----------
  function applyTransform() {
    stage.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
    updateAnts();
  }

  function isWide() {
    return wideMQ.matches;
  }

  // 위쪽 막대 · 도구 팔레트 · (넓은 화면에서 펼친) 패널을 피해서 맞춘다
  function fitInsets() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    let l = 14;
    let t = 14;
    let r = 14;
    let b = 14;
    t = Math.max(t, top.offsetHeight + 14);
    if (paletteEl.offsetWidth && paletteEl.offsetHeight) {
      if (paletteEl.offsetHeight >= paletteEl.offsetWidth) l = Math.max(l, paletteEl.offsetLeft + paletteEl.offsetWidth + 14);
      else b = Math.max(b, vh - paletteEl.offsetTop + 14);
    }
    if (state.panelOpen && isWide() && inspector.offsetWidth) r = Math.max(r, vw - inspector.offsetLeft + 14);
    if (sheet.classList.contains('open') && isWide() && sheet.offsetWidth) r = Math.max(r, vw - sheet.offsetLeft + 14);
    return { l, t, r, b, vw, vh };
  }

  function fit(manual = false) {
    const { l, t, r, b, vw, vh } = fitInsets();
    if (!vw || !vh) return;
    let aw = vw - l - r;
    let ah = vh - t - b;
    let ox = l;
    let oy = t;
    if (aw < 120 || ah < 120) {
      aw = vw - 24;
      ah = vh - 24;
      ox = 12;
      oy = 12;
    }
    const s = Math.min(aw / W, ah / H);
    state.scale = s;
    state.tx = ox + (aw - W * s) / 2;
    state.ty = oy + (ah - H * s) / 2;
    if (manual) state.autoFit = true;
    applyTransform();
  }

  function zoomAt(factor, cx, cy) {
    const ns = Math.min(8, Math.max(0.1, state.scale * factor));
    const k = ns / state.scale;
    state.tx = cx - (cx - state.tx) * k;
    state.ty = cy - (cy - state.ty) * k;
    state.scale = ns;
    state.autoFit = false;
    applyTransform();
  }

  function zoomCenter(factor) {
    zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
  }

  function toDoc(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: (clientX - r.left - state.tx) / state.scale, y: (clientY - r.top - state.ty) / state.scale };
  }

  const ro = new ResizeObserver(() => state.autoFit && fit());
  ro.observe(viewport);
  const onWideChange = () => {
    setPanelOpen(isWide());
  };
  wideMQ.addEventListener?.('change', onWideChange);

  // ---------- 포인터 ----------
  const pointers = new Map();
  let stroke = null;
  let gesture = null;
  let gestureLinger = false;
  let pan = null;
  let penSeen = false;
  let spaceDown = false;
  let raf = 0;
  let pendingTap = null;
  let lastTwoTap = 0;

  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp);
  viewport.addEventListener('pointercancel', onUp);
  viewport.addEventListener('pointerleave', () => (cursor.style.display = 'none'));
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS Safari 제스처(핀치 확대) 기본 동작 막기
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) viewport.addEventListener(t, (e) => e.preventDefault());

  function touchPoints() {
    return [...pointers.values()].filter((p) => p.type === 'touch');
  }

  function onDown(e) {
    e.preventDefault();
    if (!isWide() && state.panelOpen) setPanelOpen(false);
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const isTouch = e.pointerType === 'touch';
    if (e.pointerType === 'pen') penSeen = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    // 펜으로 그리는 중에 닿은 손바닥은 무시
    if (isTouch && ((stroke && stroke.type === 'pen') || (lassoDraw && lassoDraw.type === 'pen') || (sel?.drag && sel.drag.type === 'pen'))) return;
    const touches = touchPoints();
    if (isTouch && touches.length >= 2) {
      if (stroke && stroke.type === 'touch') {
        if (Date.now() - stroke.t0 < 300 || renderer.travel < 12) cancelStroke();
        else endStroke();
      }
      if (lassoDraw && lassoDraw.type === 'touch') {
        lassoDraw = null;
        if (!sel) clearOutline();
      }
      if (sel?.drag) sel.drag = null;
      pendingTap = null;
      pan = null;
      startGesture();
      return;
    }
    if (gesture || gestureLinger) return;
    if (isTouch && !state.penOnly && penSeen && state.palmReject) return;
    const wantsPan = state.tool === 'hand' || spaceDown || e.button === 1 || (isTouch && state.penOnly);
    if (wantsPan) {
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      viewport.classList.add('panning');
      return;
    }
    if (e.button === 2 || stroke || lassoDraw || sel?.drag) return;
    const pt = toDoc(e.clientX, e.clientY);
    const t = state.tool;
    if (TAP_TOOLS.has(t)) {
      // 손가락은 떼는 순간 실행 — 두 손가락 제스처의 첫 손가락이 칠해지지 않게
      if (isTouch) pendingTap = { id: e.pointerId, x: e.clientX, y: e.clientY, pt };
      else runTap(t, pt);
    } else if (t === 'lasso') lassoDown(e, pt);
    else beginStroke(e, pt);
  }

  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }
    if (gesture) {
      updateGesture();
      return;
    }
    if (pan && pan.id === e.pointerId) {
      state.tx = pan.tx + (e.clientX - pan.x);
      state.ty = pan.ty + (e.clientY - pan.y);
      state.autoFit = false;
      applyTransform();
      return;
    }
    updateCursor(e);
    if (pendingTap && pendingTap.id === e.pointerId && Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y) > 14) pendingTap = null;
    if ((lassoDraw && lassoDraw.id === e.pointerId) || (sel?.drag && sel.drag.id === e.pointerId)) {
      lassoMove(e, toDoc(e.clientX, e.clientY));
      return;
    }
    if (stroke && stroke.id === e.pointerId) {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const pt = toDoc(ev.clientX, ev.clientY);
        const pr = pressureOf(ev);
        if (stroke.type === 'pen') {
          stats.pressureSum += pr;
          stats.pressureN += 1;
        }
        renderer.addPoint(pt.x, pt.y, pr);
        stroke.lastPt = { ...pt, p: pr };
      }
      scheduleSync();
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (gesture) {
      if (touchPoints().length < 2) endGesture();
      if (!touchPoints().length) gestureLinger = false;
      return;
    }
    if (gestureLinger) {
      if (!touchPoints().length) gestureLinger = false;
      return;
    }
    if (pan && pan.id === e.pointerId) {
      pan = null;
      viewport.classList.remove('panning');
    }
    if (pendingTap && pendingTap.id === e.pointerId) {
      const t = pendingTap;
      pendingTap = null;
      if (e.type === 'pointerup') runTap(state.tool, t.pt);
    }
    if ((lassoDraw && lassoDraw.id === e.pointerId) || (sel?.drag && sel.drag.id === e.pointerId)) lassoUp(e);
    if (stroke && stroke.id === e.pointerId) endStroke();
  }

  function onWheel(e) {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else {
      state.tx -= e.deltaX;
      state.ty -= e.deltaY;
      state.autoFit = false;
      applyTransform();
    }
  }

  function startGesture() {
    const [a, b] = touchPoints();
    const r = viewport.getBoundingClientRect();
    gesture = {
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      m0: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
      s0: state.scale,
      tx0: state.tx,
      ty0: state.ty,
      t0: Date.now(),
      start: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }],
      moved: false,
    };
  }

  function updateGesture() {
    const pts = touchPoints();
    if (pts.length < 2) return;
    const [a, b] = pts;
    const g = gesture;
    if (!g.moved) {
      const m = Math.max(Math.hypot(a.x - g.start[0].x, a.y - g.start[0].y), Math.hypot(b.x - g.start[1].x, b.y - g.start[1].y));
      if (m < 10) return;
      g.moved = true;
    }
    const r = viewport.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
    const s = Math.min(8, Math.max(0.1, g.s0 * (d / g.d0)));
    const k = s / g.s0;
    state.scale = s;
    state.tx = m.x - (g.m0.x - g.tx0) * k;
    state.ty = m.y - (g.m0.y - g.ty0) * k;
    state.autoFit = false;
    applyTransform();
  }

  function endGesture() {
    const g = gesture;
    gesture = null;
    gestureLinger = touchPoints().length > 0;
    const now = Date.now();
    if (!g.moved && now - g.t0 < 350) {
      // 두 손가락으로 두 번 톡 → 원래 크기
      if (now - lastTwoTap < 500) {
        lastTwoTap = 0;
        fit(true);
        el.classList.add('zoom-reset');
        setTimeout(() => el.classList.remove('zoom-reset'), 400);
      } else lastTwoTap = now;
    } else if (g.moved && Math.abs(state.scale / g.s0 - 1) > 0.08 && !lsGet(ZOOM_HINT_KEY)) {
      lsSet(ZOOM_HINT_KEY, '1');
      setHint(ZOOM_HINT, 3800);
    }
  }

  function pressureOf(ev) {
    if (ev.pointerType !== 'pen' || !state.pressure) return 1;
    return ev.pressure || 0.5;
  }

  function updateCursor(e) {
    const b = BRUSHES[state.tool];
    if (e.pointerType === 'touch' || !b || stroke?.type === 'touch') {
      cursor.style.display = 'none';
      return;
    }
    const r = viewport.getBoundingClientRect();
    const size = Math.max(4, state.sizes[state.tool] * state.scale);
    cursor.style.display = 'block';
    cursor.style.width = cursor.style.height = `${size}px`;
    cursor.style.left = `${e.clientX - r.left}px`;
    cursor.style.top = `${e.clientY - r.top}px`;
  }

  // ---------- 스트로크 ----------
  function currentLayer() {
    return layers[active];
  }

  function hiddenLayerToast() {
    toast('숨긴 레이어에는 그릴 수 없어요. 눈 모양을 눌러 보이게 해 주세요.');
  }

  function beginStroke(e, pt) {
    const layer = currentLayer();
    if (!layer) return;
    if (!layer.visible) return hiddenLayerToast();
    const key = state.tool;
    const brush = BRUSHES[key];
    if (!brush) return;
    const size = state.sizes[key];
    const usePressure = state.pressure && e.pointerType === 'pen';
    stroke = { id: e.pointerId, type: e.pointerType, t0: Date.now(), brush, toolKey: key, layer, lastPt: { ...pt, p: pressureOf(e) } };
    if (brush.direct) {
      // 지우개 · 헝겊 · 스머지: 레이어에 바로 칠하고, 시작 전 모습은 복사본으로 보관
      const b = ensureBackup();
      b.clearRect(0, 0, W, H);
      b.drawImage(layer.canvas, 0, 0);
      layer.ctx.save();
      layer.ctx.globalCompositeOperation = brush.erase ? 'destination-out' : 'source-over';
      renderer.begin(layer.ctx, brush, '#000000', size, usePressure, { strength: state.strength[key], layerCanvas: layer.canvas });
    } else {
      preview.style.opacity = String(state.opacity[key]);
      preview.style.mixBlendMode = brush.blend === 'multiply' ? 'multiply' : 'normal';
      renderer.begin(solidCtx, brush, state.color, size, usePressure, brush.mix ? { sampler: makeSampler(layer.canvas) } : {});
    }
    renderer.addPoint(pt.x, pt.y, pressureOf(e));
    scheduleSync();
  }

  function scheduleSync() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncPreview();
    });
  }

  function clampRect(d) {
    if (!d) return null;
    const x = Math.max(0, Math.floor(d.x0));
    const y = Math.max(0, Math.floor(d.y0));
    const x1 = Math.min(W, Math.ceil(d.x1));
    const y1 = Math.min(H, Math.ceil(d.y1));
    if (x1 <= x || y1 <= y) return null;
    return { x, y, w: x1 - x, h: y1 - y };
  }

  const patterns = {};
  function patternFor(kind) {
    if (!patterns[kind]) patterns[kind] = previewCtx.createPattern(textureCanvas(kind), 'repeat');
    return patterns[kind];
  }

  // 바뀐 사각형만 미리보기로 옮기고 종이 질감 마스크를 씌운다 (전체 캔버스 읽기 없음)
  function syncPreview() {
    if (!stroke) return;
    const r = clampRect(renderer.takeFrameDirty());
    if (!r || stroke.brush.direct) return;
    previewCtx.clearRect(r.x, r.y, r.w, r.h);
    previewCtx.drawImage(solid, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    if (stroke.brush.texture) {
      previewCtx.globalCompositeOperation = 'destination-out';
      previewCtx.fillStyle = patternFor(stroke.brush.texture);
      previewCtx.fillRect(r.x, r.y, r.w, r.h);
      previewCtx.globalCompositeOperation = 'source-over';
    }
  }

  function cancelStroke() {
    if (!stroke) return;
    if (stroke.brush.direct) {
      stroke.layer.ctx.restore();
      stroke.layer.ctx.clearRect(0, 0, W, H);
      stroke.layer.ctx.drawImage(backup, 0, 0);
    } else {
      solidCtx.clearRect(0, 0, W, H);
      previewCtx.clearRect(0, 0, W, H);
    }
    stroke = null;
  }

  function endStroke() {
    if (!stroke) return;
    const s = stroke;
    if (s.lastPt) renderer.finish(s.lastPt.x, s.lastPt.y, s.lastPt.p);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    syncPreview();
    const rect = clampRect(renderer.dirty);
    const layer = s.layer;
    if (s.brush.direct) {
      layer.ctx.restore();
      if (rect) {
        const before = backupCtx.getImageData(rect.x, rect.y, rect.w, rect.h);
        const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
        history.push({ layerId: layer.id, rect, before, after });
      }
      if (s.brush.erase) stats.eraseCount += 1;
      else stats.strokeCount += 1;
    } else if (rect) {
      if (s.brush.wetEdge) wetEdge(preview, rect, state.sizes[s.toolKey], s.brush.wetEdge);
      const before = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      layer.ctx.save();
      layer.ctx.globalAlpha = state.opacity[s.toolKey];
      layer.ctx.globalCompositeOperation = s.brush.blend || 'source-over';
      layer.ctx.drawImage(preview, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
      layer.ctx.restore();
      const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      history.push({ layerId: layer.id, rect, before, after });
      solidCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
      previewCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
      stats.strokeCount += 1;
      trackColor(s.brush.rainbow ? null : state.color);
    }
    const now = Date.now();
    const dur = now - s.t0;
    const gap = stats.lastEnd ? Math.min(3000, Math.max(0, s.t0 - stats.lastEnd)) : 0;
    stats.activeMs += dur + gap;
    stats.lastEnd = now;
    stats.tools[s.toolKey] = (stats.tools[s.toolKey] || 0) + 1;
    stroke = null;
    touch(layer);
  }

  function touch(layer) {
    layer.touched = true;
    dirty = true;
    updateThumb(layer);
    renderLayerList();
  }

  function trackColor(hex) {
    if (!hex) {
      stats.colors.add('rainbow');
      stats.colored += 1;
      stats.warm += 1;
      return;
    }
    stats.colors.add(hex);
    const c = classifyColor(hex);
    stats.colored += 1;
    if (c.dark) stats.dark += 1;
    if (c.warm) stats.warm += 1;
    if (c.cool) stats.cool += 1;
  }

  // ---------- 채우기 · 스포이드 · 도장 ----------
  function runTap(t, pt) {
    if (t === 'fill') doFill(pt);
    else if (t === 'picker') doPick(pt);
    else if (t === 'stamp') doStamp(pt);
  }

  function referenceImage() {
    const c = canvasEl(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    // 종이 결 대신 종이 바탕색을 기준으로 삼아야 결 때문에 채우기가 끊기지 않는다
    ctx.fillStyle = PAPERS[state.paper].base;
    ctx.fillRect(0, 0, W, H);
    drawLayers(ctx);
    return ctx.getImageData(0, 0, W, H);
  }

  function doFill(pt) {
    const layer = currentLayer();
    if (!layer) return;
    if (!layer.visible) return hiddenLayerToast();
    const res = floodFill({
      ref: referenceImage(),
      barrier: templateCanvas && tplEl.style.display !== 'none' ? templateBarrier : null,
      target: layer.ctx,
      width: W,
      height: H,
      x: pt.x,
      y: pt.y,
      color: hexToRgb(state.color),
      tolerance: 40,
    });
    if (!res) return;
    history.push({ layerId: layer.id, rect: res.rect, before: res.before, after: res.after });
    stats.fillCount += 1;
    trackColor(state.color);
    touch(layer);
  }

  function doPick(pt) {
    const x = Math.floor(pt.x);
    const y = Math.floor(pt.y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = canvasEl(1, 1);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(paperCanvas, x, y, 1, 1, 0, 0, 1, 1);
    for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, x, y, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    setColor(rgbToHex(r, g, b));
    setTool(state.lastBrush || defaultTool());
    toast('색을 가져왔어요');
  }

  function doStamp(pt) {
    const layer = currentLayer();
    if (!layer) return;
    if (!layer.visible) return hiddenLayerToast();
    const size = state.sizes.stamp;
    const pad = size * 0.62;
    const rect = clampRect({ x0: pt.x - pad, y0: pt.y - pad, x1: pt.x + pad, y1: pt.y + pad });
    if (!rect) return;
    const before = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    drawStamp(layer.ctx, state.stamp, pt.x, pt.y, size, state.color);
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    history.push({ layerId: layer.id, rect, before, after });
    stats.stampCount += 1;
    stats.colors.add(state.color);
    touch(layer);
  }

  // ---------- 올가미 (선택해서 옮기기) ----------
  let lassoDraw = null;
  let sel = null;
  let outlineRaf = 0;

  function pathD(pts, close) {
    if (!pts.length) return '';
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    return close ? `${d}Z` : d;
  }

  function showOutline(d) {
    antsBg.setAttribute('d', d);
    ants.setAttribute('d', d);
    selSvg.classList.add('on');
    updateAnts();
  }

  function clearOutline() {
    antsBg.setAttribute('d', '');
    ants.setAttribute('d', '');
    selG.removeAttribute('transform');
    selSvg.classList.remove('on', 'drawing');
    antsAnim?.cancel();
    antsAnim = null;
    antsScale = 0;
  }

  // 점선(개미 행진) 굵기는 확대율과 상관없이 화면에서 같게
  let antsAnim = null;
  let antsScale = 0;
  function updateAnts() {
    if (!selSvg.classList.contains('on')) return;
    const s = state.scale;
    if (antsAnim && Math.abs(s - antsScale) < 1e-4) return;
    antsScale = s;
    const k = 1 / s;
    antsBg.style.strokeWidth = String(3.5 * k);
    ants.style.strokeWidth = String(1.6 * k);
    ants.style.strokeDasharray = `${6 * k} ${5 * k}`;
    antsAnim?.cancel();
    antsAnim = ants.animate ? ants.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -11 * k }], { duration: 650, iterations: Infinity }) : null;
  }

  function lassoDown(e, pt) {
    if (sel) {
      if (hitSelection(pt)) {
        sel.drag = { id: e.pointerId, type: e.pointerType, x: pt.x, y: pt.y, dx: sel.dx, dy: sel.dy };
        el.classList.add('sel-dragging');
      } else commitSelection();
      return;
    }
    const layer = currentLayer();
    if (!layer) return;
    if (!layer.visible) return hiddenLayerToast();
    lassoDraw = { id: e.pointerId, type: e.pointerType, pts: [pt] };
    selSvg.classList.add('drawing');
    showOutline(pathD(lassoDraw.pts, false));
  }

  function hitSelection(pt) {
    const r = sel.rect;
    const m = 18 / state.scale;
    return pt.x >= r.x + sel.dx - m && pt.x <= r.x + sel.dx + r.w + m && pt.y >= r.y + sel.dy - m && pt.y <= r.y + sel.dy + r.h + m;
  }

  function lassoMove(e, pt) {
    if (lassoDraw && lassoDraw.id === e.pointerId) {
      const last = lassoDraw.pts[lassoDraw.pts.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) * state.scale < 2.5) return;
      lassoDraw.pts.push(pt);
      if (!outlineRaf) {
        outlineRaf = requestAnimationFrame(() => {
          outlineRaf = 0;
          if (lassoDraw) showOutline(pathD(lassoDraw.pts, false));
        });
      }
    } else if (sel?.drag && sel.drag.id === e.pointerId) {
      sel.dx = Math.round(sel.drag.dx + pt.x - sel.drag.x);
      sel.dy = Math.round(sel.drag.dy + pt.y - sel.drag.y);
      positionSelection();
    }
  }

  function lassoUp(e) {
    if (lassoDraw && lassoDraw.id === e.pointerId) {
      const pts = lassoDraw.pts;
      lassoDraw = null;
      selSvg.classList.remove('drawing');
      liftSelection(pts);
    } else if (sel?.drag && sel.drag.id === e.pointerId) {
      sel.drag = null;
      el.classList.remove('sel-dragging');
    }
  }

  function liftSelection(pts) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    const r = pts.length >= 3 ? clampRect({ x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 }) : null;
    if (!r || r.w < 6 || r.h < 6) {
      clearOutline();
      return;
    }
    const layer = currentLayer();
    const path = new Path2D();
    path.moveTo(pts[0].x - r.x, pts[0].y - r.y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x - r.x, pts[i].y - r.y);
    path.closePath();
    const mask = canvasEl(r.w, r.h);
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.fill(path);
    const fl = canvasEl(r.w, r.h);
    const fctx = fl.getContext('2d');
    fctx.drawImage(layer.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    fctx.globalCompositeOperation = 'destination-in';
    fctx.drawImage(mask, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    // 고른 곳이 비어 있는지 작게 줄여서 한 번만 확인
    const ps = Math.min(1, 96 / Math.max(r.w, r.h));
    const probe = canvasEl(Math.max(1, Math.round(r.w * ps)), Math.max(1, Math.round(r.h * ps)));
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(fl, 0, 0, probe.width, probe.height);
    const pd = pctx.getImageData(0, 0, probe.width, probe.height).data;
    let any = false;
    for (let i = 3; i < pd.length; i += 4) {
      if (pd[i] > 6) {
        any = true;
        break;
      }
    }
    if (!any) {
      clearOutline();
      toast('고른 곳에 옮길 그림이 없어요. 그림을 빙 둘러서 골라 보세요.');
      return;
    }
    const b = ensureBackup();
    b.clearRect(0, 0, W, H);
    b.drawImage(layer.canvas, 0, 0);
    layer.ctx.save();
    layer.ctx.globalCompositeOperation = 'destination-out';
    layer.ctx.drawImage(mask, r.x, r.y);
    layer.ctx.restore();
    fl.className = 'sel-float';
    fl.style.width = `${r.w}px`;
    fl.style.height = `${r.h}px`;
    group.insertBefore(fl, preview);
    sel = { layer, rect: r, canvas: fl, dx: 0, dy: 0, drag: null };
    showOutline(pathD(pts, true));
    positionSelection();
    selBar.classList.remove('hidden');
    el.classList.add('has-selection');
    history.onChange();
  }

  function positionSelection() {
    if (!sel) return;
    sel.canvas.style.transform = `translate(${sel.rect.x + sel.dx}px, ${sel.rect.y + sel.dy}px)`;
    selG.setAttribute('transform', `translate(${sel.dx} ${sel.dy})`);
  }

  function endSelectionUi(s) {
    s.canvas.remove();
    s.canvas.width = s.canvas.height = 0;
    clearOutline();
    selBar.classList.add('hidden');
    el.classList.remove('has-selection', 'sel-dragging');
    history.onChange();
  }

  // 내려놓기: 옮긴 결과를 '한 번의 기록'으로 남긴다
  function commitSelection() {
    if (!sel) return;
    const s = sel;
    sel = null;
    const { layer, rect: r } = s;
    if (s.dx || s.dy) {
      layer.ctx.drawImage(s.canvas, r.x + s.dx, r.y + s.dy);
      const u = clampRect({ x0: Math.min(r.x, r.x + s.dx), y0: Math.min(r.y, r.y + s.dy), x1: Math.max(r.x + r.w, r.x + s.dx + r.w), y1: Math.max(r.y + r.h, r.y + s.dy + r.h) });
      if (u) {
        history.push({ layerId: layer.id, rect: u, before: backupCtx.getImageData(u.x, u.y, u.w, u.h), after: layer.ctx.getImageData(u.x, u.y, u.w, u.h) });
      }
      stats.tools.lasso = (stats.tools.lasso || 0) + 1;
      endSelectionUi(s);
      touch(layer);
    } else {
      restoreRect(layer, r);
      endSelectionUi(s);
      updateThumb(layer);
    }
  }

  function cancelSelection() {
    if (lassoDraw) {
      lassoDraw = null;
      if (!sel) clearOutline();
    }
    if (!sel) return;
    const s = sel;
    sel = null;
    restoreRect(s.layer, s.rect);
    endSelectionUi(s);
    updateThumb(s.layer);
  }

  function restoreRect(layer, r) {
    layer.ctx.clearRect(r.x, r.y, r.w, r.h);
    layer.ctx.drawImage(backup, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }

  // ---------- 실행 취소 ----------
  function applyEntry(p, which) {
    const layer = layers.find((l) => l.id === p.layerId);
    if (!layer) return;
    if (p[which]) layer.ctx.putImageData(p[which], p.rect.x, p.rect.y);
    else layer.ctx.clearRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
    layer.touched = true;
    updateThumb(layer);
  }

  function undo() {
    if (stroke) return;
    if (sel || lassoDraw) {
      cancelSelection();
      return;
    }
    if (history.undo(applyEntry)) {
      stats.undoCount += 1;
      dirty = true;
      renderLayerList();
    }
  }

  function redo() {
    if (stroke) return;
    commitSelection();
    if (history.redo(applyEntry)) {
      dirty = true;
      renderLayerList();
    }
  }

  history.onChange = () => {
    undoBtn.disabled = !history.canUndo && !sel;
    redoBtn.disabled = !history.canRedo;
  };
  history.onChange();

  // ---------- 키보드 ----------
  function onKey(e) {
    if (destroyed || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.type !== 'keydown') return;
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (e.type === 'keydown') redo();
    } else if (e.key === ' ') {
      spaceDown = e.type === 'keydown';
      e.preventDefault();
    } else if (e.type === 'keydown' && e.key === 'Escape') {
      if (sel || lassoDraw) cancelSelection();
      else if (sheet.classList.contains('open')) toggleSheet(false);
    } else if (e.type === 'keydown' && e.key === 'Enter' && sel) {
      commitSelection();
    } else if (e.type === 'keydown' && (e.key === '[' || e.key === ']') && BRUSHES[state.tool]) {
      const b = BRUSHES[state.tool];
      const v = Math.round(state.sizes[state.tool] * (e.key === ']' ? 1.15 : 1 / 1.15));
      state.sizes[state.tool] = Math.min(b.max, Math.max(b.min, v));
      renderPanel();
    }
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------- 도구 · 색 ----------
  function toolList() {
    return psych ? PSYCH_TOOLS : TECHNIQUES[technique].tools;
  }

  function defaultTool() {
    return toolList()[0];
  }

  function buildPalette() {
    clear(toolsEl);
    for (const k of Object.keys(toolButtons)) delete toolButtons[k];
    const list = toolList();
    paletteEl.classList.toggle('many', list.filter((t) => t !== '|').length > 9);
    for (const t of list) {
      if (t === '|') {
        toolsEl.append(h('div', { class: 'tp-sep', role: 'separator' }));
        continue;
      }
      const m = meta(t);
      const btn = h('button', { class: 'tool-btn', type: 'button', title: m.label, 'aria-label': m.label, 'data-tool': t, onclick: () => onToolClick(t) }, toolIcon(t), h('span', { class: 't-label' }, m.short));
      toolButtons[t] = btn;
      toolsEl.append(btn);
    }
    for (const [k, b] of Object.entries(toolButtons)) b.classList.toggle('active', k === state.tool);
  }

  function onToolClick(t) {
    // 이미 고른 도구를 한 번 더 누르면 속성 패널을 연다/닫는다
    if (t === state.tool && t !== 'hand') {
      openPanel('brush', true);
      return;
    }
    setTool(t);
  }

  function setTool(t) {
    if (!toolList().includes(t)) t = defaultTool();
    if (t !== 'lasso') {
      cancelLassoDraw();
      commitSelection();
    }
    state.tool = t;
    if (BRUSHES[t] && !BRUSHES[t].direct) state.lastBrush = t;
    for (const [k, b] of Object.entries(toolButtons)) b.classList.toggle('active', k === t);
    el.dataset.tool = t;
    viewport.style.cursor = t === 'hand' ? 'grab' : TAP_TOOLS.has(t) ? 'copy' : 'crosshair';
    state.tab = 'brush';
    renderPanel();
  }

  function cancelLassoDraw() {
    if (lassoDraw) {
      lassoDraw = null;
      if (!sel) clearOutline();
    }
  }

  function setColor(hex) {
    state.color = hex;
    state.recent = [hex, ...state.recent.filter((x) => x !== hex)].slice(0, 6);
    updateColorWell();
    const b = BRUSHES[state.tool];
    if ((b && b.noColor) || state.tool === 'picker' || state.tool === 'hand' || state.tool === 'lasso') setTool(state.lastBrush || defaultTool());
    else renderPanel();
  }

  function updateColorWell() {
    el.style.setProperty('--tc', state.color);
    const { l } = hsl(state.color);
    el.style.setProperty('--tc-edge', l > 0.86 ? 'rgba(0,0,0,.28)' : 'transparent');
  }

  // ---------- 속성 패널 ----------
  function setPanelOpen(open) {
    state.panelOpen = open;
    inspector.classList.toggle('open', open);
    el.classList.toggle('panel-open', open);
    colorWell.classList.toggle('on', open);
    if (open) renderPanel();
    if (state.autoFit && isWide()) requestAnimationFrame(() => fit());
  }

  function openPanel(tab, toggle = false) {
    if (psych) tab = 'brush';
    if (toggle && state.panelOpen && state.tab === tab) {
      setPanelOpen(false);
      return;
    }
    state.tab = tab;
    toggleSheet(false);
    setPanelOpen(true);
    if (psych && tab === 'settings') inspBody.querySelector('.settings-sec')?.scrollIntoView({ block: 'nearest' });
  }

  const TABS = [
    ['brush', '브러시'],
    ['layers', '레이어'],
    ['paper', '종이'],
    ['settings', '설정'],
  ];
  function renderTabs() {
    if (psych) return;
    clear(tabsEl);
    for (const [k, label] of TABS) {
      tabsEl.append(h('button', { class: `seg-btn ${state.tab === k ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => { state.tab = k; renderPanel(); } }, label));
    }
  }

  const sec = (title, ...children) => h('section', { class: 'insp-sec' }, title ? h('h4', null, title) : null, ...children);

  function sliderRow(label, min, max, value, onInput, unit = '') {
    const val = h('span', { class: 'sl-val num' }, `${value}${unit}`);
    const input = h('input', {
      type: 'range', min, max, value, 'aria-label': label,
      oninput: (e) => {
        val.textContent = `${e.target.value}${unit}`;
        onInput(Number(e.target.value));
      },
    });
    return h('div', { class: 'slider-row' }, h('span', { class: 'sl-label' }, label), input, val);
  }

  function setRow(label, sub, checked, onChange) {
    return h('div', { class: 'set-row' }, h('div', { class: 'set-text' }, h('span', null, label), sub ? h('small', null, sub) : null), switchInput(checked, onChange));
  }

  const layerListEl = h('div', { class: 'layers' });
  let sampleCanvas = null;
  let sampleRaf = 0;
  function drawSample() {
    if (!sampleCanvas || sampleRaf) return;
    sampleRaf = requestAnimationFrame(() => {
      sampleRaf = 0;
      const t = state.tool;
      if (!BRUSHES[t] || !sampleCanvas) return;
      renderBrushSample(sampleCanvas, t, state.color, Math.max(2, state.sizes[t] * 1.1), state.opacity[t], state.strength[t]);
    });
  }

  function renderPanel() {
    updateColorWell();
    renderTabs();
    if (!state.panelOpen) return;
    clear(inspBody);
    sampleCanvas = null;
    const tab = psych ? 'brush' : state.tab;
    if (tab === 'brush') renderBrushTab();
    else if (tab === 'layers') renderLayersTab();
    else if (tab === 'paper') renderPaperTab();
    else renderSettingsTab();
    if (psych) renderSettingsTab(true);
  }

  function renderBrushTab() {
    const t = state.tool;
    const brush = BRUSHES[t];
    const m = meta(t);
    const head = h('div', { class: 'tool-head' }, toolIcon(t), h('div', null, h('strong', null, m.label), h('small', null, toolTip(t))));
    inspBody.append(head);
    if (brush) {
      sampleCanvas = canvasEl(520, 112);
      sampleCanvas.className = 'brush-sample';
      inspBody.append(sampleCanvas);
      drawSample();
    }

    const usesColor = (brush && !brush.noColor && !brush.rainbow) || t === 'fill' || t === 'picker' || t === 'stamp';
    if (usesColor) {
      const pal = h('div', { class: 'palette' });
      for (const c of palette) {
        pal.append(h('button', { class: `swatch ${state.color === c ? 'active' : ''}`, type: 'button', style: { background: c }, title: c, 'aria-label': `색 ${c}`, onclick: () => setColor(c) }));
      }
      if (!psych) {
        const picker = h('input', { type: 'color', value: state.color, 'aria-label': '다른 색 고르기', onchange: (e) => setColor(e.target.value) });
        pal.append(h('label', { class: 'swatch custom', title: '다른 색' }, picker));
      }
      const recent = state.recent.filter((c) => !palette.includes(c));
      inspBody.append(
        sec('색깔',
          pal,
          recent.length ? h('div', { class: 'recent' }, h('span', { class: 'tiny muted' }, '최근'), recent.map((c) => h('button', { class: `swatch sm ${state.color === c ? 'active' : ''}`, type: 'button', style: { background: c }, 'aria-label': `최근 색 ${c}`, onclick: () => setColor(c) }))) : null,
        ),
      );
    }

    if (brush) {
      const s = sec(t === 'oil' ? '붓 크기 (호수)' : brush.strength != null ? '크기와 세기' : brush.erase || psych ? '크기' : '굵기와 진하기');
      if (t === 'oil') {
        const chips = h('div', { class: 'preset-chips' });
        for (const p of OIL_PRESETS) {
          const on = state.sizes.oil === p.size;
          chips.append(
            h('button', { class: `preset ${on ? 'on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: () => { state.sizes.oil = p.size; renderPanel(); } },
              h('span', { class: 'preset-dot', style: { width: `${Math.min(26, 4 + p.size * 0.36)}px`, height: `${Math.min(26, 4 + p.size * 0.36)}px` } }),
              p.label),
          );
        }
        s.append(chips);
      } else {
        s.append(sliderRow('굵기', brush.min, brush.max, state.sizes[t], (v) => { state.sizes[t] = v; drawSample(); }));
      }
      if (brush.strength != null) {
        s.append(sliderRow('세기', 10, 100, Math.round(state.strength[t] * 100), (v) => { state.strength[t] = v / 100; drawSample(); }, '%'));
      } else if (!brush.erase && !psych) {
        s.append(sliderRow('진하기', 10, 100, Math.round(state.opacity[t] * 100), (v) => { state.opacity[t] = v / 100; drawSample(); }, '%'));
      }
      inspBody.append(s);
    }

    if (t === 'stamp') {
      const grid = h('div', { class: 'stamps-grid' },
        STAMP_ORDER.map((k) => h('button', { class: state.stamp === k ? 'active' : '', type: 'button', title: STAMP_SHAPES[k].label, 'aria-label': `도장 ${STAMP_SHAPES[k].label}`, 'aria-pressed': String(state.stamp === k), 'data-stamp': k, onclick: () => { state.stamp = k; renderPanel(); }, html: stampSvg(k, state.color, 30) })));
      inspBody.append(sec('도장 고르기', grid, sliderRow('크기', 30, 300, state.sizes.stamp, (v) => (state.sizes.stamp = v))));
    }
  }

  function toolTip(t) {
    return {
      pencil: '가늘고 사각사각한 선',
      crayon: '거칠고 포근한 선',
      pen: '또렷하고 매끈한 선',
      marker: '겹치면 진해지는 형광 느낌',
      watercolor: '번지고 겹쳐지는 물감',
      watercolorWide: '넓게 펴 바르는 맑은 물감',
      flower: '그으면 꽃과 잎이 피어나요',
      spray: '뿌려지는 작은 점들',
      rainbow: '그으면 색이 바뀌어요',
      oil: '두껍고 결이 살아 있는 물감',
      smudge: '손가락으로 문질러 섞어요',
      rag: '헝겊으로 물감을 살살 닦아요',
      eraser: '그린 것을 지워요',
      fill: '선 안쪽을 톡 눌러 한 번에 칠해요',
      stamp: '톡 누른 곳에 도장을 찍어요',
      lasso: '빙 둘러 고른 뒤 끌어서 옮겨요',
      picker: '그림에서 색을 콕 집어 와요',
      hand: '끌어서 그림을 움직여요',
    }[t] || '';
  }

  function renderLayersTab() {
    renderLayerList();
    inspBody.append(
      sec('레이어',
        layerListEl,
        h('div', { class: 'layer-actions' },
          h('button', { class: 'pill-btn', type: 'button', onclick: () => { commitSelection(); if (addLayer()) dirty = true; } }, icon('plus', 18), '새 레이어'),
          h('button', { class: 's-btn sm', type: 'button', title: '위로', 'aria-label': '레이어 위로', onclick: () => moveLayer(1) }, icon('up', 18)),
          h('button', { class: 's-btn sm', type: 'button', title: '아래로', 'aria-label': '레이어 아래로', onclick: () => moveLayer(-1) }, icon('down', 18)),
          h('button', { class: 's-btn sm danger', type: 'button', title: '레이어 삭제', 'aria-label': '레이어 삭제', onclick: deleteLayer }, icon('trash', 18)),
        ),
        h('button', { class: 'text-btn', type: 'button', onclick: clearLayer }, '이 레이어 모두 지우기'),
      ),
    );
  }

  function renderPaperTab() {
    const grid = h('div', { class: 'paper-grid' });
    for (const k of PAPER_ORDER) {
      const p = PAPERS[k];
      const prev = paperPreview(k, 120, 84);
      prev.className = 'paper-thumb';
      grid.append(h('button', { class: `paper-opt ${state.paper === k ? 'on' : ''}`, type: 'button', 'aria-pressed': String(state.paper === k), onclick: () => choosePaper(k) }, prev, h('span', null, p.label)));
    }
    inspBody.append(sec('배경지', grid));
    if (templateCanvas) {
      const visible = tplEl.style.display !== 'none';
      const op = Math.round(Number(tplEl.style.opacity || 1) * 100);
      inspBody.append(
        sec('스케치 교재(도안)',
          setRow('도안 선 보이기', '채우기는 도안 선을 경계로 칠해요', visible, (v) => { tplEl.style.display = v ? '' : 'none'; dirty = true; }),
          sliderRow('선 진하기', 15, 100, op, (v) => { tplEl.style.opacity = String(v / 100); dirty = true; }, '%'),
        ),
      );
    }
  }

  function renderSettingsTab(inline = false) {
    const box = inline ? h('div', { class: 'settings-sec' }) : inspBody;
    if (!psych && !opts.lockTechnique) {
      const seg = h('div', { class: 'seg wide' });
      for (const [k, tq] of Object.entries(TECHNIQUES)) {
        seg.append(h('button', { class: `seg-btn ${technique === k ? 'on' : ''}`, type: 'button', onclick: () => setTechnique(k) }, techIcon(k), tq.label));
      }
      box.append(sec('그리기 방식', seg));
    }
    box.append(
      sec(inline ? '설정' : '펜과 터치',
        setRow('펜으로만 그리기', '손가락은 그림을 움직이고 확대만 해요', state.penOnly, (v) => { state.penOnly = v; el.classList.toggle('pen-only', v); }),
        setRow('펜 필압 사용', '애플펜슬처럼 누르는 힘을 느끼는 펜', state.pressure, (v) => (state.pressure = v)),
        setRow('손바닥 터치 무시', '펜을 쓰는 동안 닿은 손바닥은 그리지 않아요', state.palmReject, (v) => (state.palmReject = v)),
      ),
    );
    if (!inline) box.append(h('p', { class: 'tip-note' }, icon('sparkle', 16), h('span', null, ZOOM_HINT)));
    box.append(h('button', { class: 'danger-btn', type: 'button', onclick: () => resetCanvas() }, icon('reset', 18), psych ? '모두 지우고 다시 그리기' : '캔버스 초기화'));
    if (inline) inspBody.append(box);
  }

  function renderLayerList() {
    if (psych) return;
    clear(layerListEl);
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const item = h(
        'div',
        { class: `layer-item ${i === active ? 'active' : ''}`, onclick: () => selectLayer(i) },
        l.thumb,
        h('span', { class: 'l-name' }, l.name),
        h('button', {
          class: `eye ${l.visible ? '' : 'off'}`,
          type: 'button',
          title: l.visible ? '숨기기' : '보이기',
          'aria-label': l.visible ? '레이어 숨기기' : '레이어 보이기',
          onclick: (e) => {
            e.stopPropagation();
            commitSelection();
            l.visible = !l.visible;
            restack();
            renderLayerList();
            dirty = true;
          },
        }, icon(l.visible ? 'eye' : 'eyeOff', 20)),
      );
      layerListEl.append(item);
    }
  }

  function selectLayer(i) {
    if (i === active) return;
    commitSelection();
    active = i;
    restack();
    renderLayerList();
  }

  function moveLayer(dir) {
    commitSelection();
    const j = active + dir;
    if (j < 0 || j >= layers.length) return;
    [layers[active], layers[j]] = [layers[j], layers[active]];
    active = j;
    restack();
    renderLayerList();
    dirty = true;
  }

  async function deleteLayer() {
    if (layers.length <= 1) {
      toast('레이어가 하나뿐이라 지울 수 없어요.');
      return;
    }
    commitSelection();
    const l = currentLayer();
    if (!(await confirmDialog(`'${l.name}' 레이어를 지울까요? 되돌릴 수 없어요.`, { okLabel: '지우기', danger: true }))) return;
    layers.splice(layers.indexOf(l), 1);
    l.canvas.remove();
    history.dropLayer(l.id);
    active = Math.max(0, Math.min(layers.length - 1, active - 1));
    restack();
    renderLayerList();
    dirty = true;
  }

  async function clearLayer() {
    commitSelection();
    const l = currentLayer();
    if (!(await confirmDialog(`'${l.name}'에 그린 것을 모두 지울까요? (실행 취소로 되돌릴 수 있어요)`, { okLabel: '모두 지우기', danger: true }))) return;
    const before = l.ctx.getImageData(0, 0, W, H);
    l.ctx.clearRect(0, 0, W, H);
    history.push({ layerId: l.id, rect: { x: 0, y: 0, w: W, h: H }, before, after: null });
    touch(l);
  }

  // 캔버스 초기화: 모든 그림 레이어를 비운다 (한 번에 실행 취소 가능)
  async function resetCanvas({ confirm = true } = {}) {
    if (stroke) return false;
    if (confirm && !(await confirmDialog(psych ? '그린 것을 모두 지우고 다시 그릴까요? (실행 취소로 되돌릴 수 있어요)' : '모든 레이어의 그림을 지우고 빈 도화지로 돌아갈까요? 실행 취소로 되돌릴 수 있어요.', { okLabel: psych ? '모두 지우기' : '초기화', danger: true, title: psych ? '다시 그리기' : '캔버스 초기화' }))) return false;
    cancelSelection();
    const parts = [];
    for (const l of layers) {
      if (!l.touched) continue;
      parts.push({ layerId: l.id, rect: { x: 0, y: 0, w: W, h: H }, before: l.ctx.getImageData(0, 0, W, H), after: null });
      l.ctx.clearRect(0, 0, W, H);
      updateThumb(l);
    }
    if (parts.length) history.push({ parts });
    dirty = true;
    renderLayerList();
    setHint('새 도화지로 돌아왔어요', 1600);
    return true;
  }

  // ---------- 기법 · 배경지 ----------
  function setTechnique(t) {
    if (psych || !TECHNIQUES[t] || t === technique) return;
    cancelLassoDraw();
    commitSelection();
    const prevDefault = TECHNIQUES[technique].paper;
    technique = t;
    el.dataset.technique = t;
    if (state.paperAuto && state.paper === prevDefault) setPaper(TECHNIQUES[t].paper, { silent: true });
    buildPalette();
    setTool(toolList().includes(state.tool) ? state.tool : defaultTool());
    state.tab = 'settings';
    renderPanel();
  }

  function setPaper(kind, { silent = false } = {}) {
    if (!isPaper(kind)) return;
    state.paper = kind;
    drawPaper(paperCtx, W, H, kind);
    el.dataset.paper = kind;
    stage.classList.toggle('dark-paper', !!PAPERS[kind].dark);
    renderTemplate();
    if (!silent) dirty = true;
  }

  function choosePaper(kind) {
    const wasDark = PAPERS[state.paper].dark;
    state.paperAuto = false;
    setPaper(kind);
    // 검정 도화지를 고르면 잘 보이게 흰색으로, 다시 밝은 종이로 오면 검정으로
    if (PAPERS[kind].dark && !wasDark && classifyColor(state.color).dark) state.color = '#ffffff';
    else if (!PAPERS[kind].dark && wasDark && state.color === '#ffffff') state.color = '#222222';
    renderPanel();
  }

  // ---------- 도안 ----------
  function renderTemplate() {
    const ctx = tplEl.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!templateCanvas) return;
    ctx.drawImage(templateCanvas, 0, 0, W, H);
    if (PAPERS[state.paper].dark) {
      // 어두운 종이에서는 도안 선을 흰색으로
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#f5f5f7';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function setTemplate(canvas) {
    templateCanvas = canvas;
    if (!canvas) {
      tplEl.style.display = 'none';
      templateBarrier = null;
      renderTemplate();
      renderPanel();
      return;
    }
    const tmp = canvasEl(W, H);
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(canvas, 0, 0, W, H);
    const data = tctx.getImageData(0, 0, W, H).data;
    templateBarrier = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) templateBarrier[i] = data[i * 4 + 3] > 90 ? 1 : 0;
    renderTemplate();
    tplEl.style.display = '';
    renderPanel();
  }

  // ---------- 수업 자료 ----------
  function updateMaterialsButton() {
    const has = hasLessonContent(guide, materials);
    materialsBtn.classList.toggle('hidden', !has);
    if (!has) toggleSheet(false);
  }

  function buildSheet() {
    clear(sheetBody);
    sheetBody.append(buildMaterialsBody(guide, materials));
    sheetBuilt = true;
  }

  function toggleSheet(open) {
    const want = open ?? !sheet.classList.contains('open');
    if (want && !hasLessonContent(guide, materials)) return;
    if (want) {
      if (!sheetBuilt) buildSheet();
      if (!isWide()) setPanelOpen(false);
    }
    sheet.classList.toggle('open', want);
    sheet.setAttribute('aria-hidden', String(!want));
    materialsBtn.classList.toggle('on', want);
    el.classList.toggle('sheet-open', want);
    if (state.autoFit && isWide()) requestAnimationFrame(() => fit());
  }

  function setGuide(g) {
    guide = g || null;
    sheetBuilt = false;
    if (sheet.classList.contains('open')) buildSheet();
    updateMaterialsButton();
  }

  function setMaterials(list) {
    materials = Array.isArray(list) ? list : [];
    sheetBuilt = false;
    if (sheet.classList.contains('open')) buildSheet();
    updateMaterialsButton();
  }

  // ---------- 내보내기 ----------
  function flatten({ withPaper = true, withTemplate = true } = {}) {
    const c = canvasEl(W, H);
    const ctx = c.getContext('2d');
    if (withPaper) ctx.drawImage(paperCanvas, 0, 0);
    drawLayers(ctx);
    if (withTemplate && templateCanvas && tplEl.style.display !== 'none') {
      ctx.globalAlpha = Number(tplEl.style.opacity || 1);
      ctx.drawImage(tplEl, 0, 0);
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function thumb(maxSide = 480, quality = 0.85) {
    const full = flatten();
    const s = Math.min(1, maxSide / Math.max(W, H));
    const c = canvasEl(Math.round(W * s), Math.round(H * s));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  }

  // 픽셀 통계는 그림 레이어만 (종이 · 도안 제외)
  function pixelStats() {
    const s = Math.min(1, 320 / Math.max(W, H));
    const w = Math.max(1, Math.round(W * s));
    const hh = Math.max(1, Math.round(H * s));
    const c = canvasEl(w, hh);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    drawLayers(ctx, w, hh);
    const d = ctx.getImageData(0, 0, w, hh).data;
    let n = 0, sx = 0, sy = 0, minX = w, minY = hh, maxX = -1, maxY = -1;
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 24) {
          n++;
          sx += x;
          sy += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!n) return { inkRatio: 0, bboxRatio: 0, bbox: null, centroid: { x: 0.5, y: 0.5 } };
    const bw = (maxX - minX + 1) / w;
    const bh = (maxY - minY + 1) / hh;
    return {
      inkRatio: n / (w * hh),
      bboxRatio: bw * bh,
      bbox: { x: minX / w, y: minY / hh, w: bw, h: bh },
      centroid: { x: sx / n / w, y: sy / n / hh },
    };
  }

  function getStats() {
    const colored = Math.max(1, stats.colored);
    return {
      width: W,
      height: H,
      durationMs: Date.now() - stats.startedAt,
      activeMs: stats.activeMs,
      strokeCount: stats.strokeCount,
      eraseCount: stats.eraseCount,
      undoCount: stats.undoCount,
      fillCount: stats.fillCount,
      stampCount: stats.stampCount,
      colors: [...stats.colors].filter((c) => c !== 'stamp').slice(0, 40),
      darkStrokeRatio: stats.dark / colored,
      warmStrokeRatio: stats.warm / colored,
      coolStrokeRatio: stats.cool / colored,
      avgPressure: stats.pressureN ? stats.pressureSum / stats.pressureN : null,
      tools: { ...stats.tools },
      pixel: pixelStats(),
      technique: psych ? null : technique,
      paper: state.paper,
    };
  }

  function layerDataURL(l) {
    if (!(sel && sel.layer === l)) return l.canvas.toDataURL('image/png');
    const c = canvasEl(W, H);
    drawLayer(c.getContext('2d'), l);
    return c.toDataURL('image/png');
  }

  function getDraft() {
    return {
      version: 2,
      width: W,
      height: H,
      active,
      technique: psych ? null : technique,
      paper: state.paper,
      templateVisible: tplEl.style.display !== 'none',
      templateOpacity: Number(tplEl.style.opacity || 1),
      layers: layers.map((l) => ({ name: l.name, visible: l.visible, data: layerDataURL(l) })),
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  async function loadDraft(draft) {
    if (!draft) return;
    cancelLassoDraw();
    commitSelection();
    if (!psych && TECHNIQUES[draft.technique] && draft.technique !== technique) {
      const keepPaper = state.paper;
      setTechnique(draft.technique);
      if (!isPaper(draft.paper)) setPaper(keepPaper, { silent: true });
    }
    if (isPaper(draft.paper)) {
      state.paperAuto = false;
      setPaper(draft.paper, { silent: true });
    }
    if (draft.layers?.length) {
      for (const l of layers) l.canvas.remove();
      layers.length = 0;
      active = 0;
      history.clear();
      for (const dl of draft.layers.slice(0, MAX_LAYERS)) {
        const l = addLayer(dl.name, { select: true });
        l.visible = dl.visible !== false;
        if (dl.data) {
          try {
            l.ctx.drawImage(await loadImage(dl.data), 0, 0);
            l.touched = true;
          } catch {
            toast('레이어 하나를 불러오지 못했어요.', 'error');
          }
        }
        updateThumb(l);
      }
      active = Math.min(layers.length - 1, Math.max(0, draft.active ?? layers.length - 1));
    }
    if (draft.templateVisible === false) tplEl.style.display = 'none';
    if (draft.templateOpacity) tplEl.style.opacity = String(draft.templateOpacity);
    restack();
    renderPanel();
  }

  let hintTimer = 0;
  function setHint(text, ms = 0) {
    clearTimeout(hintTimer);
    text = stripEmoji(text);
    hintEl.textContent = text || '';
    hintEl.classList.toggle('hidden', !text);
    if (text && ms) hintTimer = setTimeout(() => hintEl.classList.add('hidden'), ms);
  }

  function destroy() {
    destroyed = true;
    ro.disconnect();
    wideMQ.removeEventListener?.('change', onWideChange);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    if (raf) cancelAnimationFrame(raf);
    if (outlineRaf) cancelAnimationFrame(outlineRaf);
    clearTimeout(hintTimer);
    el.remove();
    // iOS Safari의 캔버스 메모리를 바로 돌려준다
    for (const c of [paperCanvas, preview, solid, tplEl, backup, ...layers.map((l) => l.canvas)]) if (c) c.width = c.height = 0;
  }

  // ---------- 초기화 ----------
  el.dataset.technique = psych ? 'psych' : technique;
  el.classList.toggle('pen-only', state.penOnly);
  setPaper(state.paper, { silent: true });
  addLayer(psych ? '그림' : '레이어 1');
  buildPalette();
  setTool(defaultTool());
  setPanelOpen(state.panelOpen);
  updateMaterialsButton();
  requestAnimationFrame(() => fit());

  const api = {
    el,
    width: W,
    height: H,
    setTemplate,
    flatten,
    exportPNG: () => flatten().toDataURL('image/png'),
    thumb,
    getStats,
    getDraft,
    loadDraft,
    getTitle: () => (opts.titleEditable ? titleInput.value.trim() : opts.title || ''),
    isDirty: () => dirty,
    markClean: () => (dirty = false),
    isEmpty: () => pixelStats().inkRatio === 0,
    setHint,
    destroy,
    // 추가 API
    setTechnique,
    getTechnique: () => (psych ? null : technique),
    setPaper: (kind) => {
      state.paperAuto = false;
      setPaper(kind);
      renderPanel();
    },
    getPaper: () => state.paper,
    setGuide,
    setMaterials,
    openMaterials: () => toggleSheet(true),
    setPenOnly: (v) => {
      state.penOnly = !!v;
      el.classList.toggle('pen-only', state.penOnly);
      renderPanel();
    },
    resetCanvas,
    fitView: () => fit(true),
  };
  return api;
}
