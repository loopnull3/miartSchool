// 교사: 그림 마음 탐색 학급 리포트 / 학생별 리포트
import { api } from '../api.js';
import { h, clear, fill, toast, toastError, confirmDialog, fmtDateTime, loading } from '../ui.js';
import { go, shell } from '../app.js';
import { DOMAINS, MIND_WEATHER, PSYCH_STEPS, PSYCH_DISCLAIMER } from '/shared/psych-questions.js';
import { glyph, weatherIcon, avatarEl } from '../icons.js';

const LEVEL = {
  none: { label: '안정', cls: 'ok dot', icon: '' },
  watch: { label: '살펴보기', cls: 'warn dot', icon: '' },
  care: { label: '관심 필요', cls: 'danger dot', icon: '' },
};

function domainBars(domains, { showDesc = false } = {}) {
  return h('div', { class: 'stack', style: { gap: '14px' } },
    DOMAINS.map((d) => {
      const v = domains?.[d.key]?.score ?? domains?.[d.key] ?? null;
      return h('div', null,
        h('div', { class: 'domain-row', title: `${d.label}: ${v ?? '-'}점 — ${d.desc}` },
          h('span', { class: 'label row nowrap', style: { gap: '6px' } }, glyph(d.icon, 16), d.label),
          h('div', { class: 'bar' }, h('span', { style: { width: `${v ?? 0}%` } })),
          h('span', { class: 'val' }, v ?? '-'),
        ),
        showDesc ? h('div', { class: 'tiny faint', style: { marginLeft: '132px' } }, d.desc) : null,
      );
    }),
  );
}

function miniBars(domains) {
  return h('div', { class: 'mini-bars', title: DOMAINS.map((d) => `${d.label} ${domains[d.key].score}`).join(' · '), 'aria-label': DOMAINS.map((d) => `${d.label} ${domains[d.key].score}점`).join(', ') },
    DOMAINS.map((d) => h('span', { style: { height: `${Math.max(3, Math.round((domains[d.key].score / 100) * 26))}px` } })),
  );
}

function statTile(label, value, sub) {
  return h('div', { class: 'card flat stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-val' }, value), sub ? h('span', { class: 'tiny faint' }, sub) : null);
}

export async function classReport({ params }) {
  const r = await api.get(`/psych/campaigns/${params.id}/report`);
  const s = r.summary;
  const done = r.students.filter((x) => x.result);
  const care = done.filter((x) => x.result.attention.level === 'care');
  const watch = done.filter((x) => x.result.attention.level === 'watch');
  const avgWeather = s.overallAverage == null ? null : MIND_WEATHER.find((w) => s.overallAverage >= w.min);

  const table = h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, '학생'), h('th', null, '마음 날씨'), h('th', null, '종합'), h('th', null, '영역 (정서·표현·관계·자신감·활력)'), h('th', null, '관심 신호'), h('th', null, ''))),
      h('tbody', null,
        r.students.map(({ student: st, result: res }) =>
          res
            ? h('tr', { class: 'click', onclick: () => go(`/t/psych-result/${res.id}`) },
                h('td', null, h('div', { class: 'row nowrap', style: { gap: '8px' } }, avatarEl(st, 32), h('b', null, st.name), st.number ? h('span', { class: 'tiny faint' }, `${st.number}번`) : null)),
                h('td', null, h('span', { class: 'row nowrap', style: { gap: '6px' } }, weatherIcon(res.weather.key, 26), res.weather.label)),
                h('td', { class: 'num' }, res.overall),
                h('td', null, miniBars(res.domains)),
                h('td', null, h('span', { class: `badge ${LEVEL[res.attention.level].cls}` }, LEVEL[res.attention.level].label), res.attention.signals.length ? h('span', { class: 'tiny faint' }, ` ${res.attention.signals.length}개`) : null),
                h('td', { style: { textAlign: 'right' } }, res.has_ai ? h('span', { class: 'badge primary' }, 'AI') : null, ' ', h('span', { class: 'faint' }, '›')),
              )
            : h('tr', null,
                h('td', null, h('div', { class: 'row nowrap', style: { gap: '8px' } }, avatarEl(st, 32), h('span', { class: 'muted' }, st.name))),
                h('td', { colspan: 5, class: 'faint small' }, '아직 참여하지 않았어요'),
              ),
        ),
      ),
    ),
  );

  const signalNames = {
    scary_house: '집이 무섭다고 답함', nobody_home: '집에 아무도 없다고 답함', sad_mood: '슬픈 기분 응답', stormy_weather: '마음 날씨 비/천둥',
    worry_alone: '걱정 많음 + 이야기할 사람 없음', no_one_to_talk: '이야기할 사람 없음', no_friends_fun: '친구와 노는 게 즐겁지 않음',
    school_dislike: '학교(학원)가 좋지 않음', sleep: '잠을 잘 못 잠', tree_alone_sad: '혼자인 나무 + 슬픔', empty_drawings: '그림을 거의 그리지 않음', dark_all: '세 그림 모두 어두운 색',
  };
  const topSignals = Object.entries(s.signalCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return shell(
    h('div', null,
      h('a', { href: `#/t/c/${r.klass.id}/psych`, class: 'small muted no-print row nowrap', style: { gap: '2px', display: 'inline-flex' } }, glyph('left', 14), r.klass.name),
      h('div', { class: 'row between' },
        h('div', null, h('h1', { style: { margin: '4px 0 0' } }, r.campaign.title), h('p', { class: 'muted', style: { margin: 0 } }, `${r.klass.name} 학급 리포트 · ${r.campaign.status === 'open' ? '참여 진행 중' : '닫힘'}`)),
        h('button', { class: 'btn no-print', onclick: () => window.print() }, glyph('print', 18), ' 인쇄'),
      ),
      h('div', { class: 'notice mt' }, PSYCH_DISCLAIMER),
      h('div', { class: 'grid mt', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' } },
        statTile('참여', `${s.completed}/${s.total}명`, s.total ? `${Math.round((s.completed / s.total) * 100)}% 참여` : ''),
        statTile('학급 마음 날씨', avgWeather ? h('span', { class: 'row nowrap', style: { gap: '8px' } }, weatherIcon(avgWeather.key, 34), avgWeather.label) : '-', s.overallAverage != null ? `평균 ${s.overallAverage}점` : ''),
        statTile('관심 필요', `${care.length}명`, '관심 신호가 여러 개'),
        statTile('살펴보기', `${watch.length}명`, '관심 신호 1~2개'),
      ),
      h('div', { class: 'grid two mt' },
        h('div', { class: 'card' },
          h('h3', null, '영역별 학급 평균'),
          s.completed ? domainBars(s.domainAverages, { showDesc: true }) : h('p', { class: 'muted' }, '참여한 학생이 생기면 표시돼요.'),
        ),
        h('div', { class: 'card' },
          h('h3', null, '마음 날씨 분포'),
          h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' } },
            MIND_WEATHER.map((w) => h('div', { class: 'center card flat', style: { padding: '12px 6px' } }, weatherIcon(w.key, 40), h('div', { class: 'small muted' }, w.label), h('div', { class: 'stat-val', style: { fontSize: '1.5rem', fontWeight: 800 } }, s.weatherCounts[w.key] || 0))),
          ),
          h('h3', { class: 'mt' }, '자주 보인 관심 신호'),
          topSignals.length
            ? h('ul', { class: 'list-clean' }, topSignals.map(([k, n]) => h('li', null, h('span', { class: 'li-ico' }, '•'), h('span', { class: 'grow' }, signalNames[k] || k), h('b', { class: 'num' }, `${n}명`))))
            : h('p', { class: 'small faint' }, '특별한 관심 신호가 없어요.'),
        ),
      ),
      care.length
        ? h('div', { class: 'notice danger mt' }, `관심 필요: ${care.map((x) => x.student.name).join(', ')} — 1:1로 편안하게 대화해 보고, 걱정되는 모습이 이어지면 상담 선생님과 상의해 주세요.`)
        : null,
      h('h2', { class: 'mt-lg' }, '학생별 결과'),
      table,
    ),
    { active: 'classes' },
  );
}

export async function studentReport({ params }) {
  const r = await api.get(`/psych/results/${params.id}`);
  const rep = r.report;
  const lvl = LEVEL[rep.attention.level];

  const answerBlock = h('div', { class: 'stack' },
    PSYCH_STEPS.map((step) =>
      h('div', null,
        h('h4', { class: 'row nowrap', style: { margin: '0 0 6px', gap: '6px' } }, glyph(step.icon, 16), step.title),
        h('ul', { class: 'list-clean small' },
          step.questions.map((q) => {
            const v = r.answers[q.id];
            let text = '—';
            if (v != null) {
              if (q.type === 'text') text = v;
              else text = (Array.isArray(v) ? v : [v]).map((x) => { const o = q.options.find((oo) => oo.value === x); return o ? o.label : x; }).join(', ');
            }
            return h('li', null, h('span', { class: 'grow' }, h('span', { class: 'muted' }, q.text), h('br'), h('b', null, text)));
          }),
        ),
      ),
    ),
  );

  const drawingCards = h('div', { class: 'grid three' },
    ['house', 'tree', 'person'].map((k) => {
      const step = PSYCH_STEPS.find((s) => s.key === k);
      const d = rep.drawings[k];
      return h('div', { class: 'card', style: { padding: '12px' } },
        h('img', { src: `/api/psych/results/${r.id}/drawing/${k}`, alt: step.title, style: { width: '100%', aspectRatio: step.orientation === 'portrait' ? '3 / 4' : '4 / 3', objectFit: 'contain', background: '#fff', borderRadius: '10px', border: '1px solid var(--line)' } }),
        h('h3', { class: 'mt row nowrap', style: { marginTop: '10px', gap: '6px' } }, glyph(step.icon, 18), step.title.replace(' 그리기', '')),
        h('ul', { class: 'list-clean small' }, d.observations.map((o) => h('li', null, h('span', { class: 'li-ico', style: { color: 'var(--ink-3)' } }, glyph(o.icon, 16)), h('span', null, o.text)))),
        h('div', { class: 'tiny faint mt' }, `그린 시간 약 ${Math.max(1, Math.round(d.metrics.activeSec / 60))}분 · 획 ${d.metrics.strokes} · 지우기 ${d.metrics.erases} · 색 ${d.metrics.colors}가지`),
      );
    }),
  );

  const aiBox = h('div');
  const renderAi = (ai) => {
    clear(aiBox);
    if (ai) {
      const list = (title, items, icon) => (items?.length ? h('div', null, h('h4', { style: { margin: '10px 0 6px' } }, title), h('ul', { class: 'list-clean small' }, items.map((t) => h('li', null, h('span', { class: 'li-ico' }, glyph(icon, 16)), t)))) : null);
      aiBox.append(
        h('div', { class: 'card', style: { borderColor: '#d9d3ff', background: 'linear-gradient(180deg, #fff, #f7f5ff)' } },
          h('div', { class: 'row between' }, h('h3', { class: 'row nowrap', style: { margin: 0, gap: '6px' } }, glyph('sparkles', 18), 'AI 요약'), h('span', { class: 'tiny faint' }, fmtDateTime(ai.generatedAt))),
          h('p', { class: 'mt' }, ai.overall),
          h('div', { class: 'grid three small' },
            ['house', 'tree', 'person'].map((k) => h('div', null, h('b', null, PSYCH_STEPS.find((s) => s.key === k).title.replace(' 그리기', '')), h('p', { class: 'muted', style: { margin: '4px 0 0' } }, ai.drawings?.[k] || ''))),
          ),
          list('강점', ai.strengths, 'star'),
          list('살펴볼 점', ai.watch_points, 'search'),
          list('대화 시작 질문', ai.conversation_starters, 'heart'),
          list('수업 팁', ai.classroom_tips, 'bulb'),
          h('p', { class: 'tiny faint mt' }, 'AI 요약은 참고용이에요. 아이 이름은 AI에 보내지 않았어요.'),
          r.aiAvailable ? h('button', { class: 'btn sm mt no-print', onclick: generate }, '다시 만들기') : null,
        ),
      );
    } else if (r.aiAvailable) {
      aiBox.append(
        h('div', { class: 'card row between no-print' },
          h('div', null, h('h3', { class: 'row nowrap', style: { margin: 0, gap: '6px' } }, glyph('sparkles', 18), 'AI 요약 받기'), h('p', { class: 'small muted', style: { margin: 0 } }, '세 그림과 답변을 AI가 함께 살펴보고 교사용 요약을 만들어요. 아이 이름은 보내지 않아요.')),
          h('button', { class: 'btn primary', onclick: generate }, 'AI 요약 만들기'),
        ),
      );
    }
  };
  async function generate(e) {
    const btn = e?.currentTarget;
    if (btn) btn.disabled = true;
    fill(aiBox, h('div', { class: 'card center' }, loading(), h('p', { class: 'muted' }, 'AI가 그림을 살펴보고 있어요… (30초~1분)')));
    try {
      r.ai = await api.post(`/psych/results/${r.id}/ai-summary`);
      renderAi(r.ai);
    } catch (ex) {
      toastError(ex);
      renderAi(r.ai);
    }
  }
  renderAi(r.ai);

  const note = h('textarea', { class: 'input', rows: 4, maxlength: 2000, placeholder: '관찰 메모, 상담 내용 등 (선생님만 볼 수 있어요)' }, r.teacher_note || '');
  note.value = r.teacher_note || '';

  return shell(
    h('div', null,
      h('a', { href: `#/t/psych/${r.campaign.id}`, class: 'small muted no-print row nowrap', style: { gap: '2px', display: 'inline-flex' } }, glyph('left', 14), `${r.campaign.title} 학급 리포트`),
      h('div', { class: 'row between mt' },
        h('div', { class: 'row nowrap' },
          avatarEl(r.student, 72),
          h('div', null, h('h1', { style: { margin: 0 } }, `${r.student.name}의 그림 마음 탐색`), h('p', { class: 'muted', style: { margin: 0 } }, `${r.klass.name} · ${fmtDateTime(r.completed_at)}`)),
        ),
        h('div', { class: 'row no-print' },
          h('button', { class: 'btn', onclick: () => window.print() }, glyph('print', 18), ' 인쇄'),
          h('button', { class: 'btn danger', onclick: async () => {
            if (!(await confirmDialog('이 결과를 지우면 학생이 다시 참여할 수 있어요. 지울까요?', { okLabel: '지우고 다시 하기', danger: true }))) return;
            await api.del(`/psych/results/${r.id}`);
            toast('결과를 지웠어요');
            go(`/t/psych/${r.campaign.id}`);
          } }, '다시 하게 하기'),
        ),
      ),
      h('div', { class: 'notice mt' }, PSYCH_DISCLAIMER),
      h('div', { class: 'grid mt', style: { gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', alignItems: 'stretch' } },
        h('div', { class: 'card center' },
          h('div', { class: 'tiny muted', style: { fontWeight: 700 } }, '마음 날씨'),
          h('div', { class: 'weather-big mt' }, weatherIcon(rep.weather.key, 84)),
          h('h2', { class: 'mt' }, rep.weather.label),
          h('p', { class: 'small muted' }, rep.weather.desc),
          h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, rep.overall), h('span', { class: 'stat-label' }, '종합 점수 (0~100)')),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, '영역별 점수'), h('span', { class: `badge ${lvl.cls}` }, lvl.label)),
          h('div', { class: 'mt' }, domainBars(rep.domains, { showDesc: true })),
        ),
      ),
      rep.attention.signals.length
        ? h('div', { class: `notice ${rep.attention.level === 'care' ? 'danger' : 'warn'} mt` },
            h('b', null, '관심 신호'),
            h('ul', { style: { margin: '6px 0 0', paddingLeft: '20px' } }, rep.attention.signals.map((sg) => h('li', null, sg.text, sg.strong ? ' (중요)' : ''))),
          )
        : null,
      h('h2', { class: 'mt-lg' }, '그림 관찰'),
      drawingCards,
      h('div', { class: 'grid three mt' },
        h('div', { class: 'card' }, h('h3', null, '강점'), h('ul', { class: 'list-clean small' }, rep.strengths.map((t) => h('li', null, h('span', { class: 'li-ico', style: { color: 'var(--green)' } }, glyph('check', 16, 2.4)), t)))),
        h('div', { class: 'card' }, h('h3', null, '지도 팁'), h('ul', { class: 'list-clean small' }, rep.tips.map((t) => h('li', null, h('span', { class: 'li-ico' }, '•'), t)))),
        h('div', { class: 'card' }, h('h3', null, '대화 시작 질문'), h('ul', { class: 'list-clean small' }, rep.conversation.map((t) => h('li', null, h('span', { class: 'li-ico' }, '•'), t)))),
      ),
      h('div', { class: 'mt' }, aiBox),
      h('div', { class: 'grid two mt' },
        h('div', { class: 'card' }, h('h3', null, '아이의 답'), answerBlock),
        h('div', { class: 'card stack' },
          h('h3', { style: { margin: 0 } }, '선생님 메모'),
          note,
          h('button', { class: 'btn primary no-print', onclick: async () => {
            try {
              await api.patch(`/psych/results/${r.id}`, { teacher_note: note.value });
              toast('메모를 저장했어요', 'ok');
            } catch (ex) {
              toastError(ex);
            }
          } }, '메모 저장'),
          h('div', { class: 'notice' }, h('b', null, '아이에게 보여 준 한마디'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '20px' } }, rep.kid.points.map((p) => h('li', null, p)))),
        ),
      ),
    ),
    { active: 'classes' },
  );
}
