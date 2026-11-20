import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePsych, aggregateClass, drawingFeatures } from '../server/psych/analyze.js';
import { sanitizeSvg } from '../server/ai/svg-sanitize.js';

const normalDrawing = {
  strokeCount: 60,
  eraseCount: 2,
  undoCount: 1,
  activeMs: 150_000,
  colors: ['#222222', '#e53935', '#fdd835', '#43a047', '#1e88e5'],
  darkStrokeRatio: 0.3,
  warmStrokeRatio: 0.4,
  avgPressure: 0.5,
  pixel: { inkRatio: 0.12, bboxRatio: 0.35, centroid: { x: 0.5, y: 0.5 } },
};
const tinyDark = {
  strokeCount: 6,
  eraseCount: 8,
  undoCount: 4,
  activeMs: 20_000,
  colors: ['#222222', '#4e342e'],
  darkStrokeRatio: 1,
  warmStrokeRatio: 0,
  pixel: { inkRatio: 0.01, bboxRatio: 0.03, centroid: { x: 0.2, y: 0.85 } },
};

const positive = { h1: 'family', h2: 'warm', h3: '내 방 침대 위', t1: 'adult', t2: 'great', t3: ['flowers', 'animals'], t4: 'enough', p1: 'me', p2: 'great', p3: '친구랑 축구', p4: '강아지 키우기', s1: 'sunny', s2: 'yes', s3: 'yes', s4: 'no', s5: 'yes', s6: 'yes', s7: 'yes' };
const worried = { h1: 'nobody', h2: 'scary', t1: 'old', t2: 'verysad', t3: ['alone'], t4: 'rest', p1: 'me', p2: 'sad', s1: 'storm', s2: 'no', s3: 'no', s4: 'yes', s5: 'no', s6: 'no', s7: 'no' };

test('긍정적인 응답과 보통 그림은 맑은 마음 날씨, 관심 신호 없음', () => {
  const r = analyzePsych(positive, { house: normalDrawing, tree: normalDrawing, person: normalDrawing });
  assert.equal(r.attention.level, 'none');
  assert.ok(r.overall >= 68, `overall ${r.overall}`);
  assert.equal(r.weather.key, 'sunny');
  for (const d of Object.values(r.domains)) assert.ok(d.score >= 5 && d.score <= 95);
  assert.ok(r.strengths.length >= 1);
  assert.ok(r.kid.points.length >= 1);
  assert.ok(r.conversation.some((c) => c.includes('내 방 침대 위')));
});

test('걱정 신호가 많은 응답은 관심 필요로 분류', () => {
  const r = analyzePsych(worried, { house: tinyDark, tree: tinyDark, person: tinyDark });
  assert.equal(r.attention.level, 'care');
  assert.ok(['rain', 'cloudy'].includes(r.weather.key));
  const keys = r.attention.signals.map((s) => s.key);
  for (const k of ['scary_house', 'nobody_home', 'sad_mood', 'stormy_weather', 'worry_alone', 'dark_all']) assert.ok(keys.includes(k), k);
  assert.ok(r.domains.relation.score < 30);
  assert.ok(r.tips.some((t) => t.includes('상담')));
  // 아이에게 보여 주는 문장에는 부정적인 내용이 없어야 한다
  assert.ok(r.kid.points.every((p) => !/슬|걱정|관심/.test(p)));
});

test('그림 특징: 크기·위치·빈 그림', () => {
  assert.equal(drawingFeatures(tinyDark).size, 'tiny');
  assert.equal(drawingFeatures(tinyDark).vpos, 'bottom');
  assert.equal(drawingFeatures(tinyDark).hpos, 'left');
  assert.equal(drawingFeatures(tinyDark).eraseHeavy, true);
  assert.equal(drawingFeatures({}).empty, true);
  assert.equal(drawingFeatures(normalDrawing).colorful, true);
});

test('연필 한 가지 색 그림은 어두운 색 신호가 아니다', () => {
  const pencil = { ...normalDrawing, colors: ['#222222'], darkStrokeRatio: 1, warmStrokeRatio: 0 };
  const f = drawingFeatures(pencil);
  assert.equal(f.pencilOnly, true);
  assert.equal(f.darkDominant, false);
  const r = analyzePsych(positive, { house: pencil, tree: pencil, person: pencil });
  assert.ok(!r.attention.signals.some((s) => s.key === 'dark_all'));
  assert.ok(r.drawings.house.observations.some((o) => o.text.includes('연필 한 가지 색')));
});

test('답이 비어도 분석이 실패하지 않는다', () => {
  const r = analyzePsych({}, {});
  assert.ok(Number.isFinite(r.overall));
  assert.equal(r.drawings.house.observations.length, 1);
});

test('학급 집계', () => {
  const a = analyzePsych(positive, { house: normalDrawing, tree: normalDrawing, person: normalDrawing });
  const b = analyzePsych(worried, { house: tinyDark, tree: tinyDark, person: tinyDark });
  const s = aggregateClass([{ report: a }, { report: b }], 5);
  assert.equal(s.completed, 2);
  assert.equal(s.total, 5);
  assert.equal(s.attentionCounts.care, 1);
  assert.equal(s.attentionCounts.none, 1);
  assert.ok(s.domainAverages.emotion > 0);
});

test('SVG 정리: 위험한 요소 제거, 색 강제', () => {
  const dirty = `여기 있어요 <svg width="10" viewBox="0 0 800 600" onload="alert(1)">
    <script>alert(1)</script>
    <defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>
    <g stroke="red" stroke-width="40" fill="url(#g)">
      <circle cx="400" cy="300" r="100" fill="pink"/>
      <path d="M10 10 L 100 100 Z" style="x" onclick="evil()"/>
      <image href="http://evil/x.png"/>
      <text>hi</text>
      <rect x="1" y="2" width="3" height="4" fill="white"/>
    </g>
    <foreignObject><div>x</div></foreignObject>
  </svg> 끝`;
  const out = sanitizeSvg(dirty);
  assert.ok(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">'));
  assert.ok(!/script|onload|onclick|url\(|image|text|foreignObject|stop|style=|width="10"/i.test(out.replace(/stroke-width="\d+"/g, '')));
  assert.ok(out.includes('stroke="#222"'));
  assert.ok(out.includes('stroke-width="14"'));
  assert.ok(out.includes('<circle cx="400" cy="300" r="100" fill="none"/>'));
  assert.ok(out.includes('fill="white"'));
  assert.ok(out.endsWith('</svg>'));
});

test('SVG 정리: 도형이 없으면 오류', () => {
  assert.throws(() => sanitizeSvg('<svg viewBox="0 0 10 10"></svg>'));
  assert.throws(() => sanitizeSvg('그림 없음'));
});
