// 드로잉 스튜디오: 레이어 · 브러시 · 채우기 · 스탬프 · 스포이드 · 확대/이동 · 실행취소 · 드로잉 통계
import { h, clear, toast, confirmDialog } from '../ui.js';
import { BRUSHES, StrokeRenderer, textureCanvas } from './brushes.js';
import { floodFill } from './fill.js';
import { History } from './history.js';
import { PALETTE, PSYCH_PALETTE, hexToRgb, rgbToHex, classifyColor } from './color.js';

const STAMPS = ['⭐', '❤️', '🌸', '🌈', '☀️', '🌙', '🦋', '🐱', '🐶', '🍎', '🎈', '🎀', '✨', '🍀', '🐟', '🚀', '🎵', '🍦'];
const TOOL_META = {
  fill: { label: '채우기', icon: '🪣' },
  stamp: { label: '스탬프', icon: '⭐' },
  picker: { label: '스포이드', icon: '💉' },
  hand: { label: '이동', icon: '✋' },
};
const MAX_LAYERS = 6;

export function createStudio(root, opts = {}) {
  const W = opts.width || 1600;
  const H = opts.height || 1200;
  const mode = opts.mode || 'full';
  const toolList =
    mode === 'psych'
      ? ['pencil', 'crayon', 'pen', 'eraser', 'hand']
      : ['pencil', 'pen', 'crayon', 'marker', 'watercolor', 'oil', 'spray', 'rainbow', '|', 'fill', 'stamp', 'picker', 'eraser', 'hand'];
  const palette = mode === 'psych' ? PSYCH_PALETTE : PALETTE;

  const state = {
    tool: 'pencil',
    color: '#222222',
    sizes: Object.fromEntries(Object.entries(BRUSHES).map(([k, b]) => [k, b.size])),
    opacity: Object.fromEntries(Object.entries(BRUSHES).map(([k, b]) => [k, b.opacity])),
    stamp: '⭐',
    stampSize: 90,
    pressure: true,
    palmReject: true,
    scale: 1,
    tx: 0,
    ty: 0,
    autoFit: true,
    recent: [],
  };
  state.sizes.stamp = 90;

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

  // ---------- DOM ----------
  const viewport = h('div', { class: 'viewport' });
  const stage = h('div', { class: 'stage', style: { width: `${W}px`, height: `${H}px` } });
  const paper = canvasEl(W, H);
  paper.getContext('2d').fillStyle = '#fff';
  paper.getContext('2d').fillRect(0, 0, W, H);
  paper.style.zIndex = 0;
  const preview = canvasEl(W, H);
  const previewCtx = preview.getContext('2d');
  const solid = canvasEl(W, H);
  const solidCtx = solid.getContext('2d');
  const tplEl = canvasEl(W, H);
  tplEl.className = 'template-layer';
  tplEl.style.display = 'none';
  stage.append(paper, preview, tplEl);
  const cursor = h('div', { class: 'brush-cursor' });
  const hintEl = h('div', { class: 'studio-hint hidden' });
  viewport.append(stage, cursor, hintEl);

  const undoBtn = h('button', { class: 'btn icon', title: '실행 취소 (Ctrl+Z)', 'aria-label': '실행 취소', onclick: () => undo() }, '↶');
  const redoBtn = h('button', { class: 'btn icon', title: '다시 실행 (Ctrl+Shift+Z)', 'aria-label': '다시 실행', onclick: () => redo() }, '↷');
  const zoomLabel = h('span', { class: 'zoom-label' }, '100%');
  const titleInput = opts.titleEditable
    ? h('input', { class: 'title-input', value: opts.title || '', maxlength: 40, placeholder: '그림 제목', 'aria-label': '그림 제목', oninput: () => (dirty = true) })
    : h('span', { class: 'fun', style: { fontSize: '1.2rem', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, opts.title || '');
  const panel = h('aside', { class: 'panel' });
  const panelToggle = h('button', { class: 'btn icon panel-toggle', title: '색·굵기', 'aria-label': '색과 굵기 패널', onclick: () => panel.classList.toggle('open') }, '🎨');
  const actionsEl = h('div', { class: 'row nowrap', style: { gap: '8px' } });
  for (const a of opts.actions || []) {
    actionsEl.append(
      h('button', { class: `btn ${a.primary ? 'primary' : ''} ${a.hideSm ? 'hide-sm' : ''}`, onclick: () => a.onClick(api) }, a.icon ? h('span', null, a.icon) : null, a.label),
    );
  }

  const top = h(
    'header',
    { class: 'studio-top' },
    h('button', { class: 'btn icon', title: '나가기', 'aria-label': '나가기', onclick: () => opts.onExit?.(api) }, '←'),
    titleInput,
    h('div', { class: 'spacer' }),
    undoBtn,
    redoBtn,
    h('div', { class: 'row nowrap hide-sm', style: { gap: '2px' } },
      h('button', { class: 'btn icon sm ghost', title: '축소', 'aria-label': '축소', onclick: () => zoomCenter(1 / 1.25) }, '−'),
      zoomLabel,
      h('button', { class: 'btn icon sm ghost', title: '확대', 'aria-label': '확대', onclick: () => zoomCenter(1.25) }, '+'),
      h('button', { class: 'btn sm ghost', title: '화면에 맞추기', onclick: () => fit(true) }, '맞춤'),
    ),
    panelToggle,
    actionsEl,
  );

  const rail = h('aside', { class: 'tool-rail' });
  const toolButtons = {};
  for (const t of toolList) {
    if (t === '|') {
      rail.append(h('div', { class: 'rail-sep' }));
      continue;
    }
    const meta = BRUSHES[t] || TOOL_META[t];
    const btn = h('button', { class: 'tool-btn', title: meta.label, onclick: () => setTool(t) }, h('span', { class: 't-ico' }, meta.icon), meta.label);
    toolButtons[t] = btn;
    rail.append(btn);
  }

  const el = h('div', { class: 'studio' }, top, h('div', { class: 'studio-body' }, rail, viewport, panel));
  root.append(el);

  // ---------- 레이어 ----------
  function canvasEl(w, hh) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    return c;
  }

  function addLayer(name, { select = true } = {}) {
    if (layers.length >= MAX_LAYERS) {
      toast(`레이어는 ${MAX_LAYERS}개까지 만들 수 있어요.`);
      return null;
    }
    const canvas = canvasEl(W, H);
    const layer = { id: ++layerSeq, name: name || `레이어 ${layerSeq}`, canvas, ctx: canvas.getContext('2d'), visible: true, thumb: canvasEl(104, 78) };
    layers.splice(active + 1, 0, layer);
    stage.insertBefore(canvas, preview);
    if (select) active = layers.indexOf(layer);
    restack();
    renderPanel();
    return layer;
  }

  function restack() {
    layers.forEach((l, i) => {
      l.canvas.style.zIndex = 10 + i * 2;
      l.canvas.style.display = l.visible ? '' : 'none';
    });
    preview.style.zIndex = 10 + active * 2 + 1;
  }

  function updateThumb(layer) {
    const t = layer.thumb.getContext('2d');
    t.clearRect(0, 0, layer.thumb.width, layer.thumb.height);
    t.drawImage(layer.canvas, 0, 0, layer.thumb.width, layer.thumb.height);
  }

  // ---------- 좌표 · 확대 ----------
  function applyTransform() {
    stage.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function fit(manual = false) {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (!vw || !vh) return;
    const s = Math.min((vw - 32) / W, (vh - 32) / H);
    state.scale = s;
    state.tx = (vw - W * s) / 2;
    state.ty = (vh - H * s) / 2;
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

  // ---------- 포인터 ----------
  const pointers = new Map();
  let stroke = null;
  let gesture = null;
  let pan = null;
  let penSeen = false;
  let spaceDown = false;
  let raf = 0;

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
    panel.classList.remove('open');
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.pointerType === 'pen') penSeen = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const touches = touchPoints();
    if (e.pointerType === 'touch' && touches.length >= 2) {
      if (stroke && stroke.type === 'touch') {
        if (Date.now() - stroke.t0 < 300 || renderer.travel < 12) cancelStroke();
        else endStroke();
      }
      startGesture();
      return;
    }
    if (gesture) return;
    if (e.pointerType === 'touch' && penSeen && state.palmReject) return;
    if (state.tool === 'hand' || spaceDown || e.button === 1) {
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      return;
    }
    if (e.button === 2 || stroke) return;
    const pt = toDoc(e.clientX, e.clientY);
    if (state.tool === 'fill') doFill(pt);
    else if (state.tool === 'picker') doPick(pt);
    else if (state.tool === 'stamp') doStamp(pt);
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
      if (touchPoints().length < 2) gesture = null;
      return;
    }
    if (pan && pan.id === e.pointerId) pan = null;
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
    };
  }

  function updateGesture() {
    const pts = touchPoints();
    if (pts.length < 2) return;
    const [a, b] = pts;
    const r = viewport.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
    const s = Math.min(8, Math.max(0.1, gesture.s0 * (d / gesture.d0)));
    const k = s / gesture.s0;
    state.scale = s;
    state.tx = m.x - (gesture.m0.x - gesture.tx0) * k;
    state.ty = m.y - (gesture.m0.y - gesture.ty0) * k;
    state.autoFit = false;
    applyTransform();
  }

  function pressureOf(ev) {
    if (ev.pointerType !== 'pen' || !state.pressure) return 1;
    return ev.pressure || 0.5;
  }

  function updateCursor(e) {
    const isBrush = !!BRUSHES[state.tool];
    if (e.pointerType === 'touch' || !isBrush) {
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

  function beginStroke(e, pt) {
    const layer = currentLayer();
    if (!layer) return;
    if (!layer.visible) {
      toast('숨긴 레이어에는 그릴 수 없어요. 눈 모양을 눌러 보이게 해 주세요.');
      return;
    }
    const brush = BRUSHES[state.tool];
    if (!brush) return;
    const size = state.sizes[state.tool];
    const usePressure = state.pressure && e.pointerType === 'pen';
    stroke = { id: e.pointerId, type: e.pointerType, t0: Date.now(), brush, toolKey: state.tool, layer, lastPt: { ...pt, p: pressureOf(e) } };
    if (brush.erase) {
      stroke.backup = canvasEl(W, H);
      stroke.backup.getContext('2d').drawImage(layer.canvas, 0, 0);
      layer.ctx.save();
      layer.ctx.globalCompositeOperation = 'destination-out';
      renderer.begin(layer.ctx, brush, '#000000', size, usePressure);
    } else {
      preview.style.opacity = String(state.opacity[state.tool]);
      preview.style.mixBlendMode = brush.blend === 'multiply' ? 'multiply' : 'normal';
      renderer.begin(solidCtx, brush, state.color, size, usePressure);
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

  function syncPreview() {
    if (!stroke) return;
    const r = clampRect(renderer.takeFrameDirty());
    if (!r || stroke.brush.erase) return;
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
    if (stroke.brush.erase) {
      stroke.layer.ctx.restore();
      stroke.layer.ctx.clearRect(0, 0, W, H);
      stroke.layer.ctx.drawImage(stroke.backup, 0, 0);
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
    if (s.brush.erase) {
      layer.ctx.restore();
      if (rect) {
        const before = s.backup.getContext('2d').getImageData(rect.x, rect.y, rect.w, rect.h);
        const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
        history.push({ layerId: layer.id, rect, before, after });
      }
      stats.eraseCount += 1;
    } else if (rect) {
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

  // ---------- 채우기 · 스포이드 · 스탬프 ----------
  function referenceImage() {
    const c = canvasEl(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  function doFill(pt) {
    const layer = currentLayer();
    if (!layer || !layer.visible) return;
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
    dirty = true;
    updateThumb(layer);
    renderLayerList();
  }

  function doPick(pt) {
    const x = Math.floor(pt.x);
    const y = Math.floor(pt.y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = canvasEl(1, 1);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);
    for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, x, y, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    setColor(rgbToHex(r, g, b));
    setTool(state.lastBrush || 'pencil');
  }

  function doStamp(pt) {
    const layer = currentLayer();
    if (!layer || !layer.visible) return;
    const size = state.sizes.stamp;
    const pad = size * 0.8;
    const rect = clampRect({ x0: pt.x - pad, y0: pt.y - pad, x1: pt.x + pad, y1: pt.y + pad });
    if (!rect) return;
    const before = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    layer.ctx.save();
    layer.ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    layer.ctx.textAlign = 'center';
    layer.ctx.textBaseline = 'middle';
    layer.ctx.fillText(state.stamp, pt.x, pt.y);
    layer.ctx.restore();
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    history.push({ layerId: layer.id, rect, before, after });
    stats.stampCount += 1;
    stats.colors.add('stamp');
    dirty = true;
    updateThumb(layer);
    renderLayerList();
  }

  // ---------- 실행 취소 ----------
  function applyEntry(e, which) {
    const layer = layers.find((l) => l.id === e.layerId);
    if (!layer) return;
    layer.ctx.putImageData(e[which], e.rect.x, e.rect.y);
    updateThumb(layer);
  }

  function undo() {
    if (stroke) return;
    if (history.undo(applyEntry)) {
      stats.undoCount += 1;
      dirty = true;
      renderLayerList();
    }
  }

  function redo() {
    if (stroke) return;
    if (history.redo(applyEntry)) {
      dirty = true;
      renderLayerList();
    }
  }

  history.onChange = () => {
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
  };
  history.onChange();

  // ---------- 키보드 ----------
  function onKey(e) {
    if (destroyed || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key === ' ') {
      spaceDown = e.type === 'keydown';
      e.preventDefault();
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
  function setTool(t) {
    state.tool = t;
    if (BRUSHES[t] && !BRUSHES[t].erase) state.lastBrush = t;
    for (const [k, b] of Object.entries(toolButtons)) b.classList.toggle('active', k === t);
    viewport.style.cursor = t === 'hand' ? 'grab' : t === 'fill' || t === 'picker' || t === 'stamp' ? 'copy' : 'crosshair';
    renderPanel();
  }

  function setColor(hex) {
    state.color = hex;
    state.recent = [hex, ...state.recent.filter((x) => x !== hex)].slice(0, 6);
    if (state.tool === 'eraser' || state.tool === 'picker' || state.tool === 'hand') setTool(state.lastBrush || 'pencil');
    else renderPanel();
  }

  // ---------- 패널 ----------
  const layerListEl = h('div', { class: 'layers' });

  function renderLayerList() {
    if (mode === 'psych') return;
    clear(layerListEl);
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const item = h(
        'div',
        { class: `layer-item ${i === active ? 'active' : ''}`, onclick: () => { active = i; restack(); renderLayerList(); } },
        l.thumb,
        h('span', { class: 'l-name' }, l.name),
        h('button', {
          class: `eye ${l.visible ? '' : 'off'}`,
          title: l.visible ? '숨기기' : '보이기',
          'aria-label': l.visible ? '레이어 숨기기' : '레이어 보이기',
          onclick: (e) => {
            e.stopPropagation();
            l.visible = !l.visible;
            restack();
            renderLayerList();
            dirty = true;
          },
        }, '👁'),
      );
      layerListEl.append(item);
    }
  }

  function moveLayer(dir) {
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
    const l = currentLayer();
    if (!(await confirmDialog(`'${l.name}' 레이어를 지울까요? 되돌릴 수 없어요.`, { okLabel: '지우기', danger: true }))) return;
    layers.splice(active, 1);
    l.canvas.remove();
    history.dropLayer(l.id);
    active = Math.max(0, active - 1);
    restack();
    renderLayerList();
    dirty = true;
  }

  async function clearLayer() {
    const l = currentLayer();
    if (!(await confirmDialog(`'${l.name}'에 그린 것을 모두 지울까요? (실행 취소로 되돌릴 수 있어요)`, { okLabel: '모두 지우기', danger: true }))) return;
    const rect = { x: 0, y: 0, w: W, h: H };
    const before = l.ctx.getImageData(0, 0, W, H);
    l.ctx.clearRect(0, 0, W, H);
    history.push({ layerId: l.id, rect, before, after: l.ctx.getImageData(0, 0, W, H) });
    updateThumb(l);
    renderLayerList();
    dirty = true;
  }

  function renderPanel() {
    clear(panel);
    const t = state.tool;
    const brush = BRUSHES[t];

    // 색
    if (t !== 'eraser' && t !== 'hand') {
      const pal = h('div', { class: 'palette' });
      for (const c of palette) {
        pal.append(h('button', { class: `swatch ${state.color === c ? 'active' : ''}`, style: { background: c }, title: c, 'aria-label': `색 ${c}`, onclick: () => setColor(c) }));
      }
      if (mode !== 'psych') {
        const picker = h('input', { type: 'color', value: state.color, 'aria-label': '다른 색 고르기', onchange: (e) => setColor(e.target.value) });
        pal.append(h('label', { class: 'swatch custom', title: '다른 색' }, picker));
      }
      const recent = state.recent.filter((c) => !palette.includes(c));
      panel.append(
        h('section', null,
          h('h4', null, '색깔'),
          h('div', { class: 'current-color mb' }, h('span', { class: 'cc', style: { background: state.color } }), h('span', { class: 'small muted' }, state.color.toUpperCase())),
          pal,
          recent.length ? h('div', { class: 'palette mt' }, recent.map((c) => h('button', { class: 'swatch', style: { background: c }, onclick: () => setColor(c) }))) : null,
        ),
      );
    }

    // 굵기 · 진하기
    if (brush) {
      const sizeVal = h('span', { class: 'num' }, String(state.sizes[t]));
      const dot = h('span', { style: { width: `${Math.min(40, state.sizes[t])}px`, height: `${Math.min(40, state.sizes[t])}px`, background: brush.erase ? '#bbb' : state.color } });
      const sizeIn = h('input', {
        type: 'range', min: brush.min, max: brush.max, value: state.sizes[t], 'aria-label': '굵기',
        oninput: (e) => {
          state.sizes[t] = Number(e.target.value);
          sizeVal.textContent = e.target.value;
          dot.style.width = dot.style.height = `${Math.min(40, state.sizes[t])}px`;
        },
      });
      const sec = h('section', null, h('h4', null, `${brush.label} 굵기`), h('div', { class: 'slider-row' }, h('div', { class: 'size-preview' }, dot), sizeIn, sizeVal));
      if (!brush.erase && mode !== 'psych') {
        const opVal = h('span', { class: 'num' }, `${Math.round(state.opacity[t] * 100)}`);
        sec.append(
          h('div', { class: 'slider-row mt' }, h('span', null, '진하기'),
            h('input', { type: 'range', min: 10, max: 100, value: Math.round(state.opacity[t] * 100), 'aria-label': '진하기',
              oninput: (e) => { state.opacity[t] = Number(e.target.value) / 100; opVal.textContent = e.target.value; } }),
            opVal),
        );
      }
      panel.append(sec);
    }

    if (t === 'stamp') {
      const grid = h('div', { class: 'stamps-grid' }, STAMPS.map((s) => h('button', { class: state.stamp === s ? 'active' : '', onclick: () => { state.stamp = s; renderPanel(); } }, s)));
      const val = h('span', { class: 'num' }, String(state.sizes.stamp));
      panel.append(
        h('section', null, h('h4', null, '스탬프'), grid,
          h('div', { class: 'slider-row mt' }, h('span', null, '크기'),
            h('input', { type: 'range', min: 24, max: 260, value: state.sizes.stamp, oninput: (e) => { state.sizes.stamp = Number(e.target.value); val.textContent = e.target.value; } }),
            val)),
      );
    }
    if (t === 'fill') panel.append(h('p', { class: 'small muted' }, '칠할 곳을 톡 누르면 선 안쪽이 한 번에 칠해져요.'));
    if (t === 'picker') panel.append(h('p', { class: 'small muted' }, '그림에서 원하는 색을 누르면 그 색을 가져와요.'));
    if (t === 'hand') panel.append(h('p', { class: 'small muted' }, '끌어서 그림을 움직여요. 두 손가락으로 벌리면 확대돼요.'));

    // 레이어
    if (mode !== 'psych') {
      renderLayerList();
      panel.append(
        h('section', null,
          h('h4', null, '레이어'),
          layerListEl,
          h('div', { class: 'row mt', style: { gap: '6px' } },
            h('button', { class: 'btn sm', title: '새 레이어', onclick: () => { addLayer(); dirty = true; } }, '+ 새 레이어'),
            h('button', { class: 'btn sm icon', title: '위로', 'aria-label': '레이어 위로', onclick: () => moveLayer(1) }, '↑'),
            h('button', { class: 'btn sm icon', title: '아래로', 'aria-label': '레이어 아래로', onclick: () => moveLayer(-1) }, '↓'),
            h('button', { class: 'btn sm icon', title: '레이어 삭제', 'aria-label': '레이어 삭제', onclick: deleteLayer }, '🗑'),
          ),
          h('button', { class: 'btn sm ghost mt', onclick: clearLayer }, '이 레이어 모두 지우기'),
        ),
      );
    } else {
      panel.append(h('section', null, h('button', { class: 'btn sm', onclick: clearLayer }, '🧹 모두 지우고 다시 그리기')));
    }

    if (templateCanvas) {
      const visible = tplEl.style.display !== 'none';
      const op = Math.round(Number(tplEl.style.opacity || 1) * 100);
      panel.append(
        h('section', null,
          h('h4', null, '도안 선'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: visible, onchange: (e) => { tplEl.style.display = e.target.checked ? '' : 'none'; dirty = true; } }), '도안 선 보이기'),
          h('div', { class: 'slider-row mt' }, h('span', null, '선 진하기'),
            h('input', { type: 'range', min: 15, max: 100, value: op, oninput: (e) => { tplEl.style.opacity = String(Number(e.target.value) / 100); dirty = true; } }),
            h('span')),
        ),
      );
    }

    panel.append(
      h('section', null,
        h('h4', null, '펜 설정'),
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: state.pressure, onchange: (e) => (state.pressure = e.target.checked) }), '펜 필압 사용 (애플펜슬 등)'),
        h('label', { class: 'check small mt' }, h('input', { type: 'checkbox', checked: state.palmReject, onchange: (e) => (state.palmReject = e.target.checked) }), '펜을 쓸 때 손바닥 터치 무시'),
      ),
    );
  }

  // ---------- 도안 ----------
  function setTemplate(canvas) {
    templateCanvas = canvas;
    if (!canvas) {
      tplEl.style.display = 'none';
      templateBarrier = null;
      renderPanel();
      return;
    }
    const ctx = tplEl.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(canvas, 0, 0, W, H);
    tplEl.style.display = '';
    const data = ctx.getImageData(0, 0, W, H).data;
    templateBarrier = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) templateBarrier[i] = data[i * 4 + 3] > 90 ? 1 : 0;
    renderPanel();
  }

  // ---------- 내보내기 ----------
  function flatten({ withPaper = true, withTemplate = true } = {}) {
    const c = canvasEl(W, H);
    const ctx = c.getContext('2d');
    if (withPaper) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, 0, 0);
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

  function pixelStats() {
    const s = Math.min(1, 320 / Math.max(W, H));
    const w = Math.max(1, Math.round(W * s));
    const hh = Math.max(1, Math.round(H * s));
    const c = canvasEl(w, hh);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, 0, 0, w, hh);
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
      tools: stats.tools,
      pixel: pixelStats(),
    };
  }

  function getDraft() {
    return {
      version: 1,
      width: W,
      height: H,
      active,
      templateVisible: tplEl.style.display !== 'none',
      templateOpacity: Number(tplEl.style.opacity || 1),
      layers: layers.map((l) => ({ name: l.name, visible: l.visible, data: l.canvas.toDataURL('image/png') })),
    };
  }

  async function loadDraft(draft) {
    if (!draft?.layers?.length) return;
    for (const l of layers) l.canvas.remove();
    layers.length = 0;
    active = 0;
    for (const dl of draft.layers.slice(0, MAX_LAYERS)) {
      const l = addLayer(dl.name, { select: true });
      l.visible = dl.visible !== false;
      if (dl.data) {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = dl.data;
        });
        l.ctx.drawImage(img, 0, 0);
        updateThumb(l);
      }
    }
    active = Math.min(layers.length - 1, Math.max(0, draft.active ?? layers.length - 1));
    if (draft.templateVisible === false) tplEl.style.display = 'none';
    if (draft.templateOpacity) tplEl.style.opacity = String(draft.templateOpacity);
    restack();
    renderPanel();
  }

  function setHint(text, ms = 0) {
    hintEl.textContent = text || '';
    hintEl.classList.toggle('hidden', !text);
    if (text && ms) setTimeout(() => hintEl.classList.add('hidden'), ms);
  }

  function destroy() {
    destroyed = true;
    ro.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    if (raf) cancelAnimationFrame(raf);
    el.remove();
  }

  // ---------- 초기화 ----------
  addLayer(mode === 'psych' ? '그림' : '레이어 1');
  setTool(mode === 'psych' ? 'pencil' : 'pencil');
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
  };
  return api;
}
