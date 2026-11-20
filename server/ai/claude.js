// Claude API 연동: AI 주제 도안(SVG 생성), 그림 마음 탐색 AI 요약(비전)
import Anthropic from '@anthropic-ai/sdk';
import { sanitizeSvg } from './svg-sanitize.js';
import { one, run } from '../db.js';
import { HttpError } from '../auth.js';

const MODEL = process.env.MIART_AI_MODEL || 'claude-opus-5-5';
let client = null;

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient() {
  if (!aiAvailable()) throw new HttpError(503, 'AI 기능이 설정되지 않았습니다. (ANTHROPIC_API_KEY 필요)');
  if (!client) client = new Anthropic({ timeout: 120_000, maxRetries: 2 });
  return client;
}

// 학급(또는 교사) 단위 하루 사용량 제한
export function consumeAiQuota(scope) {
  const limit = Number(process.env.AI_DAILY_LIMIT_PER_CLASS || 60);
  const day = new Date().toISOString().slice(0, 10);
  const row = one('SELECT count FROM ai_usage WHERE scope = ? AND day = ?', scope, day);
  if (row && row.count >= limit) throw new HttpError(429, `오늘 AI 사용 한도(${limit}회)를 모두 썼어요. 내일 다시 이용해 주세요.`);
  run(
    'INSERT INTO ai_usage (scope, day, count) VALUES (?, ?, 1) ON CONFLICT(scope, day) DO UPDATE SET count = count + 1',
    scope,
    day,
  );
}

// 거절/오류 처리를 포함한 구조화 출력 호출
async function structuredCall({ system, content, schema, effort = 'medium', maxTokens = 16000 }) {
  const c = getClient();
  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'AI 요청이 많아요. 잠시 뒤에 다시 시도해 주세요.');
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(503, 'AI 키가 올바르지 않습니다. 관리자에게 문의하세요.');
    if (err instanceof Anthropic.BadRequestError) throw new HttpError(502, `AI 요청 오류: ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `AI 서버 오류 (${err.status ?? '연결'})`);
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'AI가 이 요청은 만들 수 없다고 답했어요. 다른 주제로 시도해 주세요.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'AI 응답이 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.');
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  }
}

const SKETCH_SYSTEM = `당신은 어린이(5~12세) 미술 수업용 색칠 도안을 그리는 일러스트레이터입니다.
요청받은 주제를 SVG 선화(line art) 한 장으로 그립니다.

규칙:
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"> 하나만 출력하고 width/height 속성은 쓰지 않습니다.
- 사용 가능한 요소: g, path, circle, ellipse, rect, line, polyline, polygon. text, defs, use, 그라디언트, 필터, style, 이미지, 스크립트, 외부 참조는 쓰지 않습니다.
- 모든 선: stroke="#222", stroke-width 4~7 (주요 윤곽 6, 작은 디테일 4), stroke-linecap="round", stroke-linejoin="round". 공통 속성은 바깥 <g>에 모아 둡니다.
- 면은 fill="none". 눈동자 같은 아주 작은 부분만 fill="#222", 뒤의 선을 가려야 할 때만 fill="white".
- 아이가 칠할 영역은 반드시 닫힌 도형이어야 합니다(채우기 도구가 새지 않도록 윤곽에 틈이 없게).
- 주제를 화면 가운데에 크게(캔버스의 60~85%) 배치하고 가장자리 여백 30px 이상. 어울리면 땅선, 해, 구름, 풀, 별 같은 단순한 배경 요소를 몇 개 더합니다.
- 귀엽고 단순한 스타일: 큰 면 위주, 중간 크기 디테일 약간, 너무 작은 칸은 피합니다.
- 경로 문법이 정확해야 합니다.

주제가 어린이 수업에 어울리지 않으면(폭력, 공포, 성적 내용, 실존 인물 비하, 상표/캐릭터 저작권 등) ok=false 로 하고 message 에 아이에게 보여 줄 짧고 다정한 한국어 안내를 적고 svg 는 빈 문자열로 둡니다. 유명 캐릭터를 요청하면 그 캐릭터 대신 비슷한 느낌의 독창적인 그림을 그려도 됩니다.
title 은 그림 제목(한국어, 12자 이내)입니다.`;

const SKETCH_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    title: { type: 'string' },
    svg: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['ok', 'title', 'svg', 'message'],
  additionalProperties: false,
};

export async function generateSketch(prompt) {
  const topic = String(prompt || '').trim().slice(0, 200);
  if (!topic) throw new HttpError(400, '어떤 그림을 원하는지 적어 주세요.');
  const result = await structuredCall({
    system: SKETCH_SYSTEM,
    schema: SKETCH_SCHEMA,
    effort: 'medium',
    content: [{ type: 'text', text: `색칠 도안 주제: ${topic}` }],
  });
  if (!result.ok) throw new HttpError(422, result.message || '다른 주제로 시도해 주세요.');
  let svg;
  try {
    svg = sanitizeSvg(result.svg);
  } catch (e) {
    throw new HttpError(502, `AI가 만든 그림을 읽지 못했어요: ${e.message}`);
  }
  return { title: String(result.title || topic).slice(0, 30), svg };
}

const PSYCH_SYSTEM = `당신은 초등 담임교사와 미술 교사를 돕는 아동 미술·그림 해석(HTP: 집-나무-사람) 조력자입니다.
아이가 그린 집·나무·사람 그림 세 장, 그림 뒤 질문에 대한 아이의 답, 그리고 앱이 측정한 드로잉 지표(크기·위치·색·필압·지우기·시간)와 규칙 기반 점수를 받습니다.

원칙:
- 이것은 진단이 아닙니다. 우울, 불안, ADHD, 학대 등 진단명이나 병리적 낙인을 쓰지 않습니다.
- 한 장의 그림으로 단정하지 않습니다. "~일 수 있어요", "~해 보여요"처럼 가능성으로 말합니다.
- 강점을 먼저, 구체적으로 찾습니다(그림에서 실제로 보이는 요소를 근거로).
- 그림에서 실제로 보이는 것(창문·문·굴뚝, 뿌리·가지·열매, 표정·손·발 등)을 짧게 언급하고, 보이지 않는 것을 지어내지 않습니다. 그림이 거의 비어 있으면 그렇다고 말합니다.
- 살펴볼 점은 교사가 관찰을 이어갈 수 있도록 부드럽게 적고, 근거가 약하면 비워 둡니다.
- 대화 질문은 아이에게 바로 건넬 수 있는 다정한 반말 문장으로, 교실 팁은 교사가 수업에서 바로 쓸 수 있는 활동으로 씁니다.
- 교사에게 쓰는 문장은 존댓말, 간결하게(각 항목 1~2문장). 아이 이름은 모르며 "아이"라고 부릅니다.`;

const PSYCH_SCHEMA = {
  type: 'object',
  properties: {
    overall: { type: 'string' },
    drawings: {
      type: 'object',
      properties: { house: { type: 'string' }, tree: { type: 'string' }, person: { type: 'string' } },
      required: ['house', 'tree', 'person'],
      additionalProperties: false,
    },
    strengths: { type: 'array', items: { type: 'string' } },
    watch_points: { type: 'array', items: { type: 'string' } },
    conversation_starters: { type: 'array', items: { type: 'string' } },
    classroom_tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall', 'drawings', 'strengths', 'watch_points', 'conversation_starters', 'classroom_tips'],
  additionalProperties: false,
};

// drawings: [{ kind, label, mediaType, base64 }], answerLines: ["질문: 답"], report: 규칙 기반 리포트
export async function summarizePsych({ drawings, answerLines, report, grade }) {
  const content = [];
  for (const d of drawings) {
    content.push({ type: 'text', text: `[${d.label} 그림]` });
    content.push({ type: 'image', source: { type: 'base64', media_type: d.mediaType, data: d.base64 } });
  }
  const metrics = Object.fromEntries(Object.entries(report.drawings || {}).map(([k, v]) => [k, v.metrics]));
  content.push({
    type: 'text',
    text: [
      grade ? `학년/반 정보: ${grade}` : '',
      '아이의 답:',
      ...answerLines.map((l) => `- ${l}`),
      '',
      `드로잉 지표: ${JSON.stringify(metrics)}`,
      `규칙 기반 영역 점수(0~100): ${JSON.stringify(Object.fromEntries(Object.entries(report.domains).map(([k, v]) => [k, v.score])))}`,
      `관심 신호: ${JSON.stringify((report.attention?.signals || []).map((s) => s.text))}`,
      '',
      '위 자료를 바탕으로 교사용 요약을 작성해 주세요. strengths 2~4개, watch_points 0~3개, conversation_starters 3개, classroom_tips 2~3개.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return structuredCall({ system: PSYCH_SYSTEM, schema: PSYCH_SCHEMA, effort: 'medium', content });
}
