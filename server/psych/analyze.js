// 그림 마음 탐색 규칙 기반 분석
// 입력: 답변 + 그림별 드로잉 통계(크기·위치·색·필압·지우기·시간)
// 출력: 5개 영역 점수, 마음 날씨, 그림별 관찰 포인트, 관심 신호, 강점·지도 팁·대화 시작 질문
import { DOMAINS, MIND_WEATHER, DRAWING_STEPS, optionOf } from '../../shared/psych-questions.js';

const NOUN = {
  house: { noun: '집', obj: '집을' },
  tree: { noun: '나무', obj: '나무를' },
  person: { noun: '사람', obj: '사람을' },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 그림 한 장의 특징 추출
export function drawingFeatures(stats = {}) {
  const px = stats.pixel || {};
  const ink = Number(px.inkRatio) || 0;
  const bbox = Number(px.bboxRatio) || 0;
  const cx = px.centroid ? Number(px.centroid.x) : 0.5;
  const cy = px.centroid ? Number(px.centroid.y) : 0.5;
  const strokes = Number(stats.strokeCount) || 0;
  const erases = (Number(stats.eraseCount) || 0) + (Number(stats.undoCount) || 0);
  const activeSec = (Number(stats.activeMs) || 0) / 1000;
  const colors = Array.isArray(stats.colors) ? stats.colors.length : 0;
  const dark = Number(stats.darkStrokeRatio) || 0;
  const warm = Number(stats.warmStrokeRatio) || 0;
  const pressure = stats.avgPressure == null ? null : Number(stats.avgPressure);

  const empty = ink < 0.002 || strokes + (Number(stats.fillCount) || 0) < 2;
  let size = 'normal';
  if (empty) size = 'empty';
  else if (bbox < 0.06) size = 'tiny';
  else if (bbox < 0.15) size = 'small';
  else if (bbox > 0.65) size = 'big';

  let vpos = 'middle';
  if (!empty && cy < 0.36) vpos = 'top';
  else if (!empty && cy > 0.66) vpos = 'bottom';
  let hpos = 'center';
  if (!empty && cx < 0.34) hpos = 'left';
  else if (!empty && cx > 0.66) hpos = 'right';

  const eraseHeavy = erases >= 5 && erases / Math.max(1, strokes) > 0.35;
  // 연필 한 가지 색(검정/회색)으로만 그린 것은 HTP에서 자연스러운 방식이므로 '어두운 색 선택'으로 보지 않는다.
  const pencilOnly = !empty && colors <= 1 && dark > 0.7;
  const darkDominant = !empty && colors >= 2 && dark > 0.75;
  const warmDominant = !empty && warm > 0.5;
  const colorful = colors >= 5;
  let detail = 'some';
  if (strokes > 120) detail = 'rich';
  else if (strokes >= 40) detail = 'good';
  else if (strokes < 10) detail = 'simple';
  let pace = 'normal';
  if (activeSec > 300) pace = 'long';
  else if (activeSec < 30) pace = 'quick';
  let pen = null;
  if (pressure != null && !Number.isNaN(pressure)) {
    if (pressure > 0.7) pen = 'strong';
    else if (pressure < 0.25) pen = 'light';
  }

  return { empty, size, vpos, hpos, eraseHeavy, pencilOnly, darkDominant, warmDominant, colorful, colors, detail, pace, pen, activeSec, strokes, erases, ink, bbox };
}

function observationsFor(kind, f) {
  const { noun, obj } = NOUN[kind];
  const out = [];
  if (f.empty) {
    out.push({ icon: '📄', text: `${obj} 거의 그리지 않았어요. 피곤했거나 그리기 어려웠을 수 있어요. 다음에 편안할 때 다시 기회를 주세요.` });
    return out;
  }
  if (f.size === 'tiny') out.push({ icon: '🔍', text: `${obj} 아주 작게 그렸어요. 낯선 활동이라 조심스러운 마음이 들었을 수 있어요.` });
  else if (f.size === 'small') out.push({ icon: '🔍', text: `${obj} 조금 작게 그렸어요. 차분하고 신중한 모습일 수 있어요.` });
  else if (f.size === 'big') out.push({ icon: '🖼️', text: `${obj} 화면 가득 크게 그렸어요. 표현하고 싶은 에너지가 커요.` });
  else out.push({ icon: '✅', text: `${noun}의 크기가 화면에 알맞아요. 안정감 있게 자리 잡았어요.` });

  if (f.vpos === 'top') out.push({ icon: '☁️', text: '그림이 위쪽에 자리 잡았어요. 상상과 꿈을 많이 품고 있는 모습일 수 있어요.' });
  else if (f.vpos === 'bottom') out.push({ icon: '⛰️', text: '그림이 아래쪽에 자리 잡았어요. 차분하고 현실적인 마음, 또는 기대고 싶은 마음일 수 있어요.' });
  if (f.hpos === 'left') out.push({ icon: '⬅️', text: '그림이 왼쪽으로 치우쳤어요. 지나간 일이나 익숙한 것을 떠올리는 중일 수 있어요.' });
  else if (f.hpos === 'right') out.push({ icon: '➡️', text: '그림이 오른쪽으로 치우쳤어요. 새로운 일과 앞으로의 일에 관심이 많을 수 있어요.' });

  if (f.pen === 'strong') out.push({ icon: '✊', text: '선을 힘 있게 꾹꾹 그렸어요. 에너지가 넘치거나 마음에 힘이 들어가 있을 수 있어요.' });
  else if (f.pen === 'light') out.push({ icon: '🪶', text: '선을 가볍고 섬세하게 그렸어요. 조심스럽고 세심한 성향일 수 있어요.' });

  if (f.eraseHeavy) out.push({ icon: '🧽', text: '여러 번 지우고 다시 그렸어요. 잘 그리고 싶은 마음이 커요. "고쳐 그린 부분도 멋지다"고 말해 주세요.' });

  if (f.detail === 'rich') out.push({ icon: '🔎', text: '아주 꼼꼼하게 세부까지 그렸어요. 관찰력과 집중력이 돋보여요.' });
  else if (f.detail === 'simple') out.push({ icon: '✏️', text: '간단한 선으로 핵심만 그렸어요.' });

  if (f.pace === 'long') out.push({ icon: '⏳', text: '오랜 시간 공들여 그렸어요. 끈기 있게 몰입했어요.' });
  else if (f.pace === 'quick') out.push({ icon: '⚡', text: '빠르게 완성했어요.' });

  if (f.darkDominant) out.push({ icon: '🖤', text: '여러 색 중에서 어두운 색을 주로 골랐어요. 오늘 기분이 어땠는지 가볍게 물어봐 주세요.' });
  else if (f.pencilOnly) out.push({ icon: '✏️', text: '연필 한 가지 색으로 그렸어요. 색보다 모양에 집중한 그림이에요.' });
  else if (f.colorful) out.push({ icon: '🌈', text: `${f.colors}가지 색을 다양하게 썼어요. 감정 표현이 풍부해요.` });
  else if (f.warmDominant) out.push({ icon: '🧡', text: '따뜻한 색을 많이 썼어요. 밝고 따뜻한 느낌이 전해져요.' });
  return out;
}

// [-1, 1] 신호들의 가중 평균 → 0~100 점수
function domainScore(signals) {
  let sw = 0;
  let sv = 0;
  for (const [v, w] of signals) {
    if (v == null || Number.isNaN(v)) continue;
    sv += clamp(v, -1, 1) * w;
    sw += w;
  }
  if (!sw) return 50;
  return Math.round(clamp(50 + 45 * (sv / sw), 5, 95));
}

const pick = (value, table) => (value in table ? table[value] : null);

export function analyzePsych(answers = {}, drawingStats = {}) {
  const a = answers;
  const feats = {};
  for (const k of DRAWING_STEPS) feats[k] = drawingFeatures(drawingStats[k]);

  const sizeVal = { empty: -1, tiny: -0.9, small: -0.4, normal: 0.5, big: 0.8 };
  const exprSize = { empty: -1, tiny: -0.7, small: -0.3, normal: 0.4, big: 0.8 };
  const textVal = (t) => {
    const s = String(t || '').trim();
    if (!s) return -0.2;
    return s.length >= 12 ? 1 : 0.5;
  };
  const moodScore = (id) => {
    const o = optionOf(id, a[id]);
    return o && typeof o.score === 'number' ? o.score / 2 : null;
  };
  const t3 = Array.isArray(a.t3) ? a.t3 : a.t3 ? [a.t3] : [];

  const emotion = [
    [pick(a.h2, { warm: 1, fun: 1, calm: 0.5, lonely: -0.6, scary: -1 }), 1],
    [moodScore('t2'), 1],
    [moodScore('p2'), 1],
    [moodScore('s1'), 1.5],
    [pick(a.s4, { yes: -1, sometimes: -0.3, no: 0.6 }), 1],
    [pick(a.s7, { yes: 0.6, sometimes: 0, no: -0.8 }), 0.7],
    [pick(a.s6, { yes: 0.5, sometimes: 0, no: -0.7 }), 0.5],
  ];
  const relation = [
    [pick(a.h1, { family: 1, friends: 0.9, animals: 0.5, me: -0.2, nobody: -0.9 }), 1],
    [t3.length ? (t3.includes('alone') ? -0.8 : Math.min(1, 0.35 * t3.filter((x) => ['trees', 'animals', 'people', 'flowers'].includes(x)).length)) : null, 0.8],
    [pick(a.p1, { family: 0.7, friend: 0.8, teacher: 0.5, me: 0.3, imaginary: 0.2 }), 0.6],
    [pick(a.s2, { yes: 1, sometimes: 0.1, no: -1 }), 1.3],
    [pick(a.s6, { yes: 1, sometimes: 0, no: -1 }), 1.3],
    [a.t4 === 'friends' ? -0.4 : null, 0.5],
  ];
  const confidence = [
    [pick(a.s5, { yes: 1, sometimes: 0.1, no: -1 }), 1.5],
    [a.p1 === 'me' && (moodScore('p2') ?? 0) > 0 ? 0.6 : null, 0.5],
  ];
  const energy = [
    [pick(a.s3, { yes: 1, sometimes: 0.1, no: -1 }), 1.5],
    [pick(a.h2, { fun: 1, warm: 0.6, calm: 0.1, lonely: -0.5, scary: -0.8 }), 0.6],
    [pick(a.t4, { enough: 0.8, water: 0.1, sun: 0.1, friends: -0.1, rest: -0.7 }), 0.8],
    [pick(a.s7, { yes: 0.5, sometimes: 0, no: -0.7 }), 0.5],
  ];
  const expression = [
    [textVal(a.h3), 0.5],
    [textVal(a.p3), 0.5],
    [textVal(a.p4), 0.5],
  ];

  for (const k of DRAWING_STEPS) {
    const f = feats[k];
    confidence.push([sizeVal[f.size], k === 'person' ? 0.9 : 0.6]);
    expression.push([exprSize[f.size], 0.7]);
    if (f.empty) continue;
    if (f.darkDominant) emotion.push([-0.6, 0.5]);
    if (f.warmDominant) emotion.push([0.4, 0.3]);
    if (f.eraseHeavy) {
      emotion.push([-0.3, 0.3]);
      confidence.push([-0.5, 0.5]);
    }
    if (f.pen === 'light') confidence.push([-0.3, 0.3]);
    if (f.pen === 'strong') energy.push([0.4, 0.3]);
    if (f.pace === 'quick') energy.push([-0.3, 0.3]);
    expression.push([f.colors >= 5 ? 0.8 : f.colors >= 3 ? 0.4 : f.colors === 2 ? 0 : -0.3, 0.6]);
    expression.push([{ rich: 0.8, good: 0.5, some: 0.1, simple: -0.5 }[f.detail], 0.5]);
    expression.push([f.pace === 'long' ? 0.6 : f.pace === 'quick' ? -0.5 : f.activeSec >= 90 ? 0.4 : 0, 0.4]);
  }

  const scores = {
    emotion: domainScore(emotion),
    expression: domainScore(expression),
    relation: domainScore(relation),
    confidence: domainScore(confidence),
    energy: domainScore(energy),
  };
  const domains = {};
  for (const d of DOMAINS) {
    const s = scores[d.key];
    domains[d.key] = { score: s, level: s >= 65 ? 'high' : s >= 45 ? 'mid' : 'low' };
  }
  const overall = Math.round(Object.values(scores).reduce((x, y) => x + y, 0) / DOMAINS.length);
  const weather = MIND_WEATHER.find((w) => overall >= w.min) || MIND_WEATHER[MIND_WEATHER.length - 1];

  // 관심 신호
  const signals = [];
  const sig = (key, text, strong = false) => signals.push({ key, text, strong });
  if (a.h2 === 'scary') sig('scary_house', "집에 들어가면 '무서워요'라고 답했어요.", true);
  if (a.h1 === 'nobody') sig('nobody_home', "집에 '아무도 안 살아요'라고 답했어요.");
  const t2 = moodScore('t2');
  const p2 = moodScore('p2');
  if ((t2 != null && t2 <= -0.5 && p2 != null && p2 <= -0.5) || a.t2 === 'verysad' || a.p2 === 'verysad')
    sig('sad_mood', '나무나 사람의 기분을 슬프다고 답했어요.', a.t2 === 'verysad' || a.p2 === 'verysad');
  if (a.s1 === 'rain' || a.s1 === 'storm') sig('stormy_weather', `요즘 마음 날씨를 '${a.s1 === 'storm' ? '천둥 번개' : '비'}'(으)로 골랐어요.`, a.s1 === 'storm');
  if (a.s4 === 'yes' && a.s6 === 'no') sig('worry_alone', '걱정이 많은데 속상할 때 이야기할 사람이 없다고 답했어요.', true);
  else if (a.s6 === 'no') sig('no_one_to_talk', '속상할 때 이야기할 사람이 없다고 답했어요.');
  if (a.s2 === 'no') sig('no_friends_fun', '친구들과 노는 게 즐겁지 않다고 답했어요.');
  if (a.s3 === 'no') sig('school_dislike', '학교(학원)에 오는 게 좋지 않다고 답했어요.');
  if (a.s7 === 'no') sig('sleep', '밤에 잠을 잘 못 잔다고 답했어요.');
  if (t3.includes('alone') && t2 != null && t2 < 0) sig('tree_alone_sad', '나무가 혼자이고 기분이 좋지 않다고 답했어요.');
  const emptyCount = DRAWING_STEPS.filter((k) => feats[k].empty).length;
  if (emptyCount >= 2) sig('empty_drawings', '그림을 거의 그리지 않은 단계가 여러 개예요.');
  if (DRAWING_STEPS.every((k) => feats[k].darkDominant)) sig('dark_all', '세 그림 모두 어두운 색을 주로 사용했어요.');

  const weight = signals.reduce((s, x) => s + (x.strong ? 2 : 1), 0);
  let level = weight >= 3 ? 'care' : weight >= 1 ? 'watch' : 'none';
  if (level === 'none' && scores.emotion < 35) level = 'watch';

  // 강점
  const strengthText = {
    emotion: '마음이 편안하고 안정적인 모습이 보여요.',
    expression: '생각과 느낌을 그림으로 풍부하게 표현해요.',
    relation: '가족·친구와 따뜻하게 연결되어 있다고 느껴요.',
    confidence: '자신을 믿고 당당하게 표현하는 힘이 있어요.',
    energy: '학교생활에 대한 즐거움과 에너지가 느껴져요.',
  };
  const sorted = [...DOMAINS].sort((x, y) => scores[y.key] - scores[x.key]);
  const strengths = sorted.filter((d) => scores[d.key] >= 55).slice(0, 2).map((d) => strengthText[d.key]);
  for (const k of DRAWING_STEPS) {
    const f = feats[k];
    if (f.detail === 'rich') strengths.push(`${NOUN[k].obj} 세부까지 꼼꼼하게 그리는 관찰력이 있어요.`);
    else if (f.colorful) strengths.push(`${NOUN[k].noun} 그림에서 다양한 색을 자유롭게 써요.`);
    else if (f.pace === 'long') strengths.push(`${NOUN[k].noun} 그림에 오래 몰입하는 끈기가 있어요.`);
  }
  if (!strengths.length) strengths.push('끝까지 검사에 참여한 성실함이 돋보여요.');

  // 지도 팁 (낮은 영역 중심)
  const tipBank = {
    emotion: [
      '아이가 좋아하는 주제로 자유 그리기 시간을 주어 편안한 마음으로 시작하게 해 주세요.',
      "오늘 기분을 색으로 칠해 보는 '감정 색칠' 활동을 추천해요.",
    ],
    expression: [
      "완성한 그림에 대해 '이야기 들려주기' 시간을 주세요. 말로 표현하는 연습이 도움이 돼요.",
      '다양한 재료(크레파스·수채화 브러시)를 자유롭게 써 보도록 격려해 주세요.',
    ],
    relation: [
      '짝 그림·모둠 벽화처럼 함께 그리는 활동으로 자연스러운 교류 기회를 만들어 주세요.',
      '친구 그림에 칭찬 스티커를 붙여 주는 감상 활동을 해 보세요.',
    ],
    confidence: [
      "결과보다 과정을 구체적으로 칭찬해 주세요. (예: '이 선을 정말 꼼꼼하게 그렸구나')",
      '큰 화면에 마음껏 크게 그려 보는 활동으로 성공 경험을 쌓게 해 주세요.',
    ],
    energy: [
      '짧고 금방 완성할 수 있는 과제로 성취감을 느끼게 해 주세요.',
      '아이가 잘하는 것을 반 친구들 앞에서 소개할 기회를 주세요.',
    ],
  };
  const tips = [];
  const lows = [...DOMAINS].sort((x, y) => scores[x.key] - scores[y.key]);
  for (const d of lows.slice(0, 2)) if (scores[d.key] < 60) tips.push(tipBank[d.key][0]);
  if (lows[0] && scores[lows[0].key] < 45) tips.push(tipBank[lows[0].key][1]);
  if (level === 'care') tips.push('관심 신호가 여러 개 보여요. 1:1로 편안하게 이야기 나누고, 계속되면 상담 선생님과 상의해 주세요.');
  if (!tips.length) tips.push('지금처럼 아이의 표현을 존중하고 칭찬해 주세요.');

  // 대화 시작 질문
  const conversation = [];
  const h3 = String(a.h3 || '').trim();
  const p3 = String(a.p3 || '').trim();
  const p4 = String(a.p4 || '').trim();
  if (h3) conversation.push(`"집에서 '${h3}'이(가) 제일 좋다고 했지? 거기서 뭐 하는 걸 좋아해?"`);
  if (p4) conversation.push(`"그림 속 사람이 '${p4}'을(를) 바란다고 했는데, 너도 그런 마음이 있어?"`);
  if (p3) conversation.push(`"그림 속 사람이 '${p3}' 하고 있다고 했지? 그 이야기를 더 들려줄래?"`);
  conversation.push('"세 그림 중에 제일 마음에 드는 그림은 뭐야? 왜 그래?"');
  if (a.s1) {
    const o = optionOf('s1', a.s1);
    if (o) conversation.push(`"요즘 마음 날씨가 '${o.label}'라고 했지? 어떤 일 때문에 그런지 궁금해."`);
  }

  // 아이에게 보여 줄 긍정 요약
  const kidPoints = [];
  const kidText = {
    emotion: '마음이 따뜻하고 편안한 그림이에요.',
    expression: '상상한 것을 멋지게 표현했어요.',
    relation: '소중한 사람들을 아끼는 마음이 느껴져요.',
    confidence: '자신 있게 쓱쓱 잘 그렸어요.',
    energy: '힘차고 활기찬 에너지가 느껴져요.',
  };
  for (const d of sorted.slice(0, 2)) kidPoints.push(kidText[d.key]);
  for (const k of DRAWING_STEPS) {
    const f = feats[k];
    if (f.colorful) {
      kidPoints.push('여러 가지 색을 멋지게 썼어요! 🌈');
      break;
    }
  }
  for (const k of DRAWING_STEPS) {
    if (feats[k].pace === 'long' || feats[k].detail === 'rich') {
      kidPoints.push('끝까지 꼼꼼하게 정성을 다했어요! ⭐');
      break;
    }
  }

  const drawings = {};
  for (const k of DRAWING_STEPS) {
    const f = feats[k];
    drawings[k] = {
      observations: observationsFor(k, f),
      metrics: {
        size: f.size,
        position: `${f.vpos}-${f.hpos}`,
        colors: f.colors,
        strokes: f.strokes,
        erases: f.erases,
        activeSec: Math.round(f.activeSec),
        pen: f.pen,
        inkRatio: Math.round(f.ink * 1000) / 1000,
        bboxRatio: Math.round(f.bbox * 1000) / 1000,
      },
    };
  }

  return {
    version: 1,
    domains,
    overall,
    weather: { key: weather.key, label: weather.label, emoji: weather.emoji, desc: weather.desc },
    drawings,
    attention: { level, signals },
    strengths: strengths.slice(0, 4),
    tips: tips.slice(0, 4),
    conversation: conversation.slice(0, 4),
    kid: { headline: '마음을 담아 멋지게 그렸어요!', points: kidPoints.slice(0, 3) },
    generatedAt: new Date().toISOString(),
  };
}

// 학급 리포트 집계
export function aggregateClass(results, studentCount) {
  const n = results.length;
  const avg = {};
  for (const d of DOMAINS) {
    avg[d.key] = n ? Math.round(results.reduce((s, r) => s + (r.report.domains?.[d.key]?.score ?? 50), 0) / n) : null;
  }
  const weatherCounts = Object.fromEntries(MIND_WEATHER.map((w) => [w.key, 0]));
  const attentionCounts = { none: 0, watch: 0, care: 0 };
  for (const r of results) {
    weatherCounts[r.report.weather?.key] = (weatherCounts[r.report.weather?.key] || 0) + 1;
    attentionCounts[r.report.attention?.level || 'none'] += 1;
  }
  const signalCounts = {};
  for (const r of results) for (const s of r.report.attention?.signals || []) signalCounts[s.key] = (signalCounts[s.key] || 0) + 1;
  return {
    completed: n,
    total: studentCount,
    domainAverages: avg,
    overallAverage: n ? Math.round(results.reduce((s, r) => s + (r.report.overall || 0), 0) / n) : null,
    weatherCounts,
    attentionCounts,
    signalCounts,
  };
}
