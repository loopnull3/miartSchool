// 마음 날씨 체크인 — 학생 시트 · 학생 기록 · 교사 대시보드(달력 + 추이 그래프)
import { api } from '../api.js';
import { h, clear, fill, modal, toast, fmtDate, icon } from '../ui.js';
import { shell } from '../app.js';
import { WEATHERS, EMOTIONS, CAUSES, MAX_EMOTIONS, weatherOf } from '/shared/checkin.js';

export function weatherBadge(key) {
  return weatherOf(key) || { emoji: '❔', label: '모름', level: 0 };
}

// 학생: 오늘의 마음 날씨 고르기
export function openCheckinSheet(entry, onSaved) {
  const st = { weather: entry?.weather || null, emotions: [...(entry?.emotions || [])], causes: [...(entry?.causes || [])] };
  const wGrid = h('div', { class: 'weather-pick' });
  const eChips = h('div', { class: 'chips' });
  const cChips = h('div', { class: 'chips' });
  const note = h('textarea', { class: 'input', rows: 2, maxlength: 200, placeholder: '선생님께 하고 싶은 말이 있으면 적어 주세요. (선택)' });
  note.value = entry?.note || '';
  const render = () => {
    fill(wGrid, 
      ...WEATHERS.map((w) =>
        h('button', { class: st.weather === w.key ? 'on' : '', 'aria-pressed': String(st.weather === w.key), onclick: () => { st.weather = w.key; render(); } },
          h('span', { class: 'w-emoji' }, w.emoji), h('span', { class: 'w-label' }, w.label), h('span', { class: 'w-desc' }, w.desc)),
      ),
    );
    fill(eChips, 
      ...EMOTIONS.map((e) =>
        h('button', {
          class: `chip ${st.emotions.includes(e.key) ? 'on' : ''}`,
          onclick: () => {
            if (st.emotions.includes(e.key)) st.emotions = st.emotions.filter((x) => x !== e.key);
            else if (st.emotions.length >= MAX_EMOTIONS) toast(`기분은 ${MAX_EMOTIONS}개까지 고를 수 있어요.`);
            else st.emotions.push(e.key);
            render();
          },
        }, e.label),
      ),
    );
    fill(cChips, 
      ...CAUSES.map((c) =>
        h('button', { class: `chip ${st.causes.includes(c.key) ? 'on' : ''}`, onclick: () => { st.causes = st.causes.includes(c.key) ? st.causes.filter((x) => x !== c.key) : [...st.causes, c.key]; render(); } }, c.label),
      ),
    );
  };
  render();
  const today = new Date();
  modal({
    title: '오늘의 마음은 어떤 날씨인가요?',
    body: h('div', null,
      h('p', { class: 'small faint', style: { marginTop: '-10px' } }, `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`),
      wGrid,
      h('div', { class: 'q-label' }, '지금 기분을 골라 주세요', h('span', { class: 'small faint', style: { fontWeight: 400 } }, `(최대 ${MAX_EMOTIONS}개)`)),
      eChips,
      h('div', { class: 'q-label' }, '왜 그런 기분이 들었나요?'),
      cChips,
      h('div', { class: 'q-label' }, '한마디'),
      note,
    ),
    actions: [
      { label: '나중에' },
      {
        label: '저장하기',
        class: 'primary',
        onClick: async () => {
          if (!st.weather) {
            toast('오늘의 마음 날씨를 골라 주세요.');
            return true;
          }
          const saved = await api.post('/student/checkin', { ...st, note: note.value });
          toast(`${weatherBadge(saved.weather).emoji} 마음 날씨를 저장했어요`, 'ok');
          onSaved?.(saved);
        },
      },
    ],
  });
}

export async function studentCheckinPage() {
  const ck = await api.get('/student/checkin');
  const list = h('div', { class: 'list-group' });
  const render = () => {
    clear(list);
    if (!ck.recent.length) list.append(h('div', { class: 'muted' }, '아직 기록이 없어요.'));
    for (const e of ck.recent) {
      const w = weatherBadge(e.weather);
      list.append(
        h('div', null, h('span', { style: { fontSize: '28px' } }, w.emoji),
          h('div', { class: 'grow' }, h('b', null, w.label), h('div', { class: 'small muted' }, e.emotions.map((k) => EMOTIONS.find((x) => x.key === k)?.label).filter(Boolean).join(' · '))),
          h('span', { class: 'small faint' }, fmtDate(e.day + 'T00:00:00'))),
      );
    }
  };
  render();
  return shell(
    h('div', { class: 'page mid', style: { padding: 0 } },
      h('div', { class: 'page-head' }, h('h1', null, '내 마음 날씨'), ck.enabled ? h('button', { class: 'btn primary', onclick: () => openCheckinSheet(ck.entry, (e) => { ck.recent = [e, ...ck.recent.filter((x) => x.day !== e.day)]; ck.entry = e; render(); }) }, ck.entry ? '오늘 다시 고르기' : '체크인하기') : null),
      list,
    ),
    { active: 'home' },
  );
}

// ---------------- 교사 대시보드 ----------------
function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function shiftMonth(month, d) {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function mostCommon(entries) {
  const c = {};
  for (const e of entries) c[e.weather] = (c[e.weather] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// 추이 그래프 (한 계열, SVG, 마우스/터치 툴팁)
function trendChart(points, days, title) {
  const W = 760;
  const H = 260;
  const pad = { l: 64, r: 18, t: 16, b: 30 };
  const x = (d) => pad.l + ((d - 1) / Math.max(1, days - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + ((6 - v) / 5) * (H - pad.t - pad.b);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    svg.append(n);
    return n;
  };
  for (const w of WEATHERS) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(w.level), y2: y(w.level), stroke: '#e5e5ea', 'stroke-width': 1 });
    el('text', { x: pad.l - 10, y: y(w.level) + 6, 'text-anchor': 'end', 'font-size': 18 }, w.emoji);
  }
  for (const d of [1, 5, 10, 15, 20, 25, days]) el('text', { x: x(d), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: '#86868b' }, `${d}일`);
  const pts = points.filter((p) => p.v != null);
  if (pts.length) {
    // 끊긴 날은 선을 잇지 않는다
    let dpath = '';
    let prev = null;
    for (const p of pts) {
      dpath += `${prev && p.d === prev.d + 1 ? 'L' : 'M'}${x(p.d).toFixed(1)} ${y(p.v).toFixed(1)} `;
      prev = p;
    }
    el('path', { d: dpath, fill: 'none', stroke: '#0071e3', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    for (const p of pts) el('circle', { cx: x(p.d), cy: y(p.v), r: 4, fill: '#0071e3', stroke: '#fff', 'stroke-width': 2 });
  } else {
    el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-size': 14, fill: '#86868b' }, '이 달에는 기록이 없어요');
  }
  const cross = el('line', { x1: 0, x2: 0, y1: pad.t, y2: H - pad.b, stroke: '#1d1d1f', 'stroke-opacity': 0.25, 'stroke-width': 1, visibility: 'hidden' });
  const tip = h('div', { class: 'chart-tip' });
  const wrap = h('div', { class: 'chart-wrap' }, svg, tip);
  const onMove = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    let best = null;
    for (const p of pts) if (!best || Math.abs(x(p.d) - sx) < Math.abs(x(best.d) - sx)) best = p;
    if (!best || Math.abs(x(best.d) - sx) > 30) {
      tip.style.display = 'none';
      cross.setAttribute('visibility', 'hidden');
      return;
    }
    cross.setAttribute('x1', x(best.d));
    cross.setAttribute('x2', x(best.d));
    cross.setAttribute('visibility', 'visible');
    tip.textContent = best.label;
    tip.style.display = 'block';
    tip.style.left = `${(x(best.d) / W) * r.width}px`;
    tip.style.top = `${(y(best.v) / H) * r.height}px`;
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', () => {
    tip.style.display = 'none';
    cross.setAttribute('visibility', 'hidden');
  });
  return wrap;
}

function dayDetail(day, rows, students) {
  const byId = new Map(students.map((s) => [s.id, s]));
  modal({
    title: `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 마음 날씨`,
    wide: true,
    body: rows.length ? checkinTable(rows, byId, {}) : h('p', { class: 'muted' }, '이 날은 기록이 없어요.'),
  });
}

function checkinTable(rows, byId, streaks) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, '학생'), h('th', null, '마음 날씨'), h('th', null, '기분'), h('th', null, '이유'), h('th', null, '한마디'))),
      h('tbody', null,
        rows.map((e) => {
          const s = byId.get(e.student_id) || { name: '?', avatar: '🙂' };
          const w = weatherBadge(e.weather);
          return h('tr', null,
            h('td', null, h('div', { class: 'row nowrap', style: { gap: '8px' } }, h('span', { class: 'avatar sm' }, s.avatar), h('b', null, s.name), streaks[e.student_id] ? h('span', { class: 'badge danger' }, `${streaks[e.student_id]}일째 비·천둥`) : null)),
            h('td', null, `${w.emoji} ${w.label}`),
            h('td', null, h('div', { class: 'chips', style: { gap: '4px' } }, e.emotions.map((k) => h('span', { class: `badge ${EMOTIONS.find((x) => x.key === k)?.positive ? 'ok' : 'warn'}` }, EMOTIONS.find((x) => x.key === k)?.label || k)))),
            h('td', { class: 'small' }, e.causes.map((k) => CAUSES.find((x) => x.key === k)?.label).filter(Boolean).join(', ') || '-'),
            h('td', { class: 'small' }, e.note || ''),
          );
        }),
      ),
    ),
  );
}

export async function checkinTab(root, data) {
  const k = data.klass;
  let month = null;
  let who = '';
  const body = h('div');
  root.append(body);

  async function load() {
    fill(body, h('div', { class: 'loading' }, h('div', { class: 'spinner' })));
    const r = await api.get(`/classes/${k.id}/checkins${month ? `?month=${month}` : ''}`);
    month = r.month;
    render(r);
  }

  function render(r) {
    const days = monthDays(month);
    const byId = new Map(r.students.map((s) => [s.id, s]));
    const entries = who ? r.entries.filter((e) => e.student_id === Number(who)) : r.entries;
    const byDay = {};
    for (const e of entries) (byDay[e.day] ||= []).push(e);
    const isThisMonth = r.today.startsWith(month);
    const elapsed = isThisMonth ? Number(r.today.slice(8)) : days;
    const todayRows = r.entries.filter((e) => e.day === r.today);
    const common = mostCommon(entries);
    const rate = r.students.length ? Math.round((r.entries.length / (r.students.length * Math.max(1, elapsed))) * 100) : 0;
    const streakIds = Object.keys(r.streaks);

    const studentSel = h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { who = e.target.value; render(r); } },
      h('option', { value: '' }, '우리 반 전체'),
      r.students.map((s) => h('option', { value: s.id, selected: String(s.id) === who }, `${s.avatar} ${s.name}`)),
    );

    // 달력
    const [yy, mm] = month.split('-').map(Number);
    const first = new Date(yy, mm - 1, 1).getDay();
    const cal = h('div', { class: 'cal' }, ['일', '월', '화', '수', '목', '금', '토'].map((d) => h('div', { class: 'dow' }, d)));
    for (let i = 0; i < first; i++) cal.append(h('div', { class: 'day out' }));
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      const list = byDay[key] || [];
      const top = mostCommon(list);
      const dow = (first + d - 1) % 7;
      cal.append(
        h('button', {
          class: `day ${key === r.today ? 'today' : ''} ${dow === 0 ? 'sun' : ''}`,
          style: { border: 'none', cursor: list.length ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' },
          title: list.length ? `${d}일 · ${list.length}명 기록` : `${d}일`,
          onclick: () => list.length && dayDetail(key, list, r.students),
        },
          h('span', { class: 'd' }, d),
          top ? h('span', { class: 'w' }, weatherBadge(top).emoji) : null,
          !who && list.length ? h('span', { class: 'cnt' }, `${list.length}명`) : null,
        ),
      );
    }

    // 추이
    const points = [];
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      const list = byDay[key] || [];
      if (!list.length) continue;
      const v = list.reduce((s0, e) => s0 + weatherBadge(e.weather).level, 0) / list.length;
      const wl = WEATHERS.reduce((best, w) => (Math.abs(w.level - v) < Math.abs(best.level - v) ? w : best), WEATHERS[0]);
      points.push({ d, v, label: who ? `${d}일 · ${weatherBadge(list[0].weather).emoji} ${weatherBadge(list[0].weather).label}` : `${d}일 · 평균 ${wl.emoji} ${wl.label} (${list.length}명)` });
    }

    // 날씨별 개수 (숫자 타일)
    const counts = Object.fromEntries(WEATHERS.map((w) => [w.key, 0]));
    for (const e of entries) counts[e.weather] = (counts[e.weather] || 0) + 1;

    fill(body, 
      h('div', { class: 'row between mb' },
        h('div', { class: 'row' },
          h('button', { class: 'round-btn', 'aria-label': '이전 달', onclick: () => { month = shiftMonth(month, -1); load(); } }, icon('left')),
          h('h2', { style: { margin: 0, minWidth: '140px', textAlign: 'center' } }, `${yy}년 ${mm}월`),
          h('button', { class: 'round-btn', 'aria-label': '다음 달', onclick: () => { month = shiftMonth(month, 1); load(); } }, icon('right')),
        ),
        studentSel,
      ),
      r.klass.checkin_enabled ? null : h('div', { class: 'notice warn mb' }, '마음 날씨 체크인이 꺼져 있어요. 설정 탭에서 켤 수 있어요.'),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' } },
        h('div', { class: 'card stat' }, h('span', { class: 'stat-label' }, '오늘 체크인'), h('span', { class: 'stat-val' }, `${todayRows.length}/${r.students.length}`)),
        h('div', { class: 'card stat' }, h('span', { class: 'stat-label' }, '이번 달 참여율'), h('span', { class: 'stat-val' }, `${Math.min(100, rate)}%`)),
        h('div', { class: 'card stat' }, h('span', { class: 'stat-label' }, who ? '자주 고른 날씨' : '가장 많은 날씨'), h('span', { class: 'stat-val' }, common ? `${weatherBadge(common).emoji} ${weatherBadge(common).label}` : '-')),
        h('div', { class: 'card stat' }, h('span', { class: 'stat-label' }, '관심이 필요한 친구'), h('span', { class: 'stat-val' }, `${streakIds.length}명`), h('span', { class: 'tiny faint' }, '최근 2일 이상 비·천둥')),
      ),
      h('div', { class: 'grid two mt' },
        h('div', { class: 'card' }, h('h3', null, '마음 날씨 달력'), cal),
        h('div', { class: 'card' },
          h('h3', null, who ? `${byId.get(Number(who))?.name}의 마음 변화` : '우리 반 평균 마음 변화'),
          trendChart(points, days, '날짜별 마음 날씨'),
          h('div', { class: 'grid mt', style: { gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' } },
            WEATHERS.map((w) => h('div', { class: 'center', title: `${w.label} ${counts[w.key]}회` }, h('div', { style: { fontSize: '22px' } }, w.emoji), h('div', { class: 'tiny muted' }, w.label), h('b', { class: 'num' }, counts[w.key]))),
          ),
        ),
      ),
      h('div', { class: 'section-title' }, h('h2', null, '오늘의 마음'), h('span', { class: 'small faint' }, `${todayRows.length}명 기록`)),
      todayRows.length ? checkinTable(todayRows, byId, r.streaks) : h('p', { class: 'muted' }, '오늘은 아직 체크인한 학생이 없어요.'),
    );
  }
  await load();
}
