// AI 연동 테스트: 가짜 Messages API 서버로 요청 형태와 응답 처리를 확인한다 (실제 과금 없음)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'miart-ai-'));
const requests = [];
let nextReply = null;

const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = JSON.parse(body || '{}');
    requests.push({ url: req.url, headers: req.headers, body: json });
    const reply = typeof nextReply === 'function' ? nextReply(json) : nextReply;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: json.model,
        content: reply.stop_reason === 'refusal' ? [] : [{ type: 'text', text: JSON.stringify(reply.payload) }],
        stop_reason: reply.stop_reason || 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    );
  });
});

await new Promise((r) => mock.listen(0, '127.0.0.1', r));
process.env.DATA_DIR = tmp;
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
process.env.ADMIN_EMAIL = 'root@test.kr';
process.env.ADMIN_PASSWORD = 'rootpass123';

const { openDb, closeDb, run } = await import('../server/db.js');
const { createApp } = await import('../server/index.js');
const { hashPassword } = await import('../server/auth.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let server;
let base;
let cookie = '';
let kidCookie = '';

async function call(method, url, body, who = 'teacher') {
  const headers = { 'x-miart': '1', cookie: who === 'teacher' ? cookie : kidCookie };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(base + '/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  for (const c of res.headers.getSetCookie?.() || []) {
    const pair = c.split(';')[0];
    if (pair.startsWith('miart_sid=')) {
      if (who === 'teacher') cookie = pair;
      else kidCookie = pair;
    }
  }
  return { status: res.status, data: await res.json() };
}

before(async () => {
  openDb();
  run("INSERT INTO users (role, email, name, password_hash, status) VALUES ('teacher', 't@test.kr', '선생님', ?, 'active')", hashPassword('password123'));
  await new Promise((r) => (server = createApp().listen(0, '127.0.0.1', r)));
  base = `http://127.0.0.1:${server.address().port}`;
  await call('POST', '/auth/login', { email: 't@test.kr', password: 'password123' });
});

after(() => {
  server?.close();
  mock.close();
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('AI 주제 도안: 요청 형태 + SVG 정리', async () => {
  nextReply = {
    payload: {
      ok: true,
      title: '우주 고래',
      svg: '<svg viewBox="0 0 800 600"><script>x</script><g stroke="blue" stroke-width="6" fill="none"><ellipse cx="400" cy="300" rx="200" ry="120"/></g></svg>',
      message: '',
    },
  };
  const r = await call('POST', '/ai/sketch', { prompt: '우주를 나는 고래' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.title, '우주 고래');
  assert.ok(!r.data.svg.includes('script'));
  assert.ok(r.data.svg.includes('stroke="#222"'));
  assert.ok(r.data.svg.includes('<ellipse cx="400" cy="300" rx="200" ry="120"/>'));

  const req = requests.at(-1);
  assert.match(req.url, /\/v1\/messages/);
  assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.fallbacks, 'default');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.output_config.effort, 'medium');
  assert.ok(!('thinking' in req.body) || req.body.thinking.type === 'adaptive');
  assert.ok(req.body.messages[0].content[0].text.includes('우주를 나는 고래'));
});

test('AI 주제 도안: 아이에게 맞지 않는 주제 / 거절 처리', async () => {
  nextReply = { payload: { ok: false, title: '', svg: '', message: '다른 주제로 그려 볼까요?' } };
  let r = await call('POST', '/ai/sketch', { prompt: '무서운 것' });
  assert.equal(r.status, 422);
  assert.equal(r.data.error, '다른 주제로 그려 볼까요?');

  nextReply = { stop_reason: 'refusal' };
  r = await call('POST', '/ai/sketch', { prompt: '무언가' });
  assert.equal(r.status, 422);
});

test('마음 탐색 AI 요약: 그림 이미지 + 답변 전달, 이름은 보내지 않음', async () => {
  const klass = await call('POST', '/classes', { name: '비밀반' });
  const kids = await call('POST', `/classes/${klass.data.id}/students`, { names: '홍길동' });
  const kid = kids.data[0];
  await call('POST', '/auth/student/login', { code: kid.access_code, animal: kid.animal, fruit: kid.fruit }, 'kid');
  const camp = await call('POST', `/classes/${klass.data.id}/psych`, { title: '테스트' });
  const drawing = { image: PNG, thumb: PNG, stats: { strokeCount: 30, pixel: { inkRatio: 0.1, bboxRatio: 0.3, centroid: { x: 0.5, y: 0.5 } } } };
  const sub = await call('POST', `/student/psych/${camp.data.id}/submit`, { answers: { h1: 'family', h3: '거실', s1: 'sunny' }, drawings: { house: drawing, tree: drawing, person: drawing } }, 'kid');
  assert.equal(sub.status, 200);
  const report = await call('GET', `/psych/campaigns/${camp.data.id}/report`);
  const rid = report.data.students[0].result.id;

  nextReply = {
    payload: {
      overall: '전반적으로 안정된 모습이에요.',
      drawings: { house: '창문이 있어요.', tree: '줄기가 곧아요.', person: '팔을 벌리고 있어요.' },
      strengths: ['가족과 가까워요'],
      watch_points: [],
      conversation_starters: ['거실에서 뭐 하는 걸 좋아해?'],
      classroom_tips: ['모둠 활동'],
    },
  };
  const r = await call('POST', `/psych/results/${rid}/ai-summary`);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.overall, '전반적으로 안정된 모습이에요.');
  const req = requests.at(-1);
  const images = req.body.messages[0].content.filter((b) => b.type === 'image');
  assert.equal(images.length, 3);
  assert.equal(images[0].source.type, 'base64');
  const allText = JSON.stringify(req.body);
  assert.ok(!allText.includes('홍길동'), '학생 이름이 AI 요청에 들어가면 안 됨');
  assert.ok(allText.includes('거실'));
  const detail = await call('GET', `/psych/results/${rid}`);
  assert.equal(detail.data.ai.strengths[0], '가족과 가까워요');

  // 학급에서 AI를 끄면 거부
  await call('PATCH', `/classes/${klass.data.id}`, { ai_enabled: false });
  const off = await call('POST', `/psych/results/${rid}/ai-summary`);
  assert.equal(off.status, 403);
});
