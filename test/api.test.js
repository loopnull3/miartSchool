import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'miart-test-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_EMAIL = 'root@test.kr';
process.env.ADMIN_PASSWORD = 'rootpass123';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const { openDb, closeDb } = await import('../server/db.js');
const { createApp, ensureAdmin } = await import('../server/index.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let server;
let base;

function client() {
  let cookie = '';
  const call = async (method, url, body, { csrf = true } = {}) => {
    const headers = {};
    if (csrf) headers['x-miart'] = '1';
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + '/api' + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(';');
      if (pair.startsWith('miart_sid=')) cookie = pair.endsWith('=') ? '' : pair;
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data };
  };
  return {
    get: (u) => call('GET', u),
    post: (u, b = {}, o) => call('POST', u, b, o),
    put: (u, b = {}) => call('PUT', u, b),
    patch: (u, b = {}) => call('PATCH', u, b),
    del: (u, b) => call('DELETE', u, b),
  };
}

before(async () => {
  openDb();
  ensureAdmin();
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const ctx = {};

test('CSRF 헤더 없는 변경 요청은 거부', async () => {
  const c = client();
  const r = await c.post('/auth/login', { email: 'x', password: 'y' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('교사 가입 → 승인 대기 → 관리자 승인 → 로그인', async () => {
  const t = client();
  let r = await t.post('/auth/register', { email: 'pending@test.kr', password: 'short', name: '대기' });
  assert.equal(r.status, 400);
  r = await t.post('/auth/register', { email: 'pending@test.kr', password: 'password123', name: '대기 선생님', schoolName: '테스트초' });
  assert.equal(r.data.status, 'pending');
  r = await t.post('/auth/login', { email: 'pending@test.kr', password: 'password123' });
  assert.equal(r.status, 403);

  const admin = client();
  r = await admin.post('/auth/login', { email: 'root@test.kr', password: 'rootpass123' });
  assert.equal(r.status, 200);
  r = await admin.get('/admin/teachers');
  const pending = r.data.find((u) => u.email === 'pending@test.kr');
  assert.equal(pending.status, 'pending');
  r = await admin.post(`/admin/teachers/${pending.id}/status`, { status: 'active' });
  assert.equal(r.status, 200);
  r = await t.post('/auth/login', { email: 'pending@test.kr', password: 'password123' });
  assert.equal(r.status, 200);

  // 학교 인증 코드로 가입하면 바로 사용
  r = await admin.post('/admin/schools', { name: '미아트초' });
  ctx.schoolCode = r.data.invite_code;
  ctx.admin = admin;
});

test('학교 코드로 가입한 교사가 학급·학생·과제를 만든다', async () => {
  const t = client();
  let r = await t.post('/auth/register', { email: 'teacher@test.kr', password: 'password123', name: '김선생', schoolCode: ctx.schoolCode });
  assert.equal(r.data.status, 'active');
  r = await t.get('/auth/me');
  assert.equal(r.data.kind, 'user');
  assert.equal(r.data.user.school_name, '미아트초');

  r = await t.post('/classes', { name: '3-2', grade: '3학년' });
  assert.equal(r.status, 200);
  assert.match(r.data.code, /^[A-Z0-9]{6}$/);
  ctx.klass = r.data;

  r = await t.post(`/classes/${ctx.klass.id}/students`, { names: '1 김하늘\n2. 이바다\n박구름\n' });
  assert.equal(r.data.length, 3);
  assert.equal(r.data[0].number, 1);
  assert.equal(r.data[1].name, '이바다');
  assert.equal(r.data[2].number, null);
  assert.match(r.data[0].pin, /^\d{4}$/);
  ctx.students = r.data;

  r = await t.post(`/classes/${ctx.klass.id}/assignments`, { title: '고양이 색칠', templateRef: 'builtin:cat' });
  assert.equal(r.data.template_ref, 'builtin:cat');
  ctx.assignment = r.data;
  r = await t.post(`/classes/${ctx.klass.id}/assignments`, { title: 'x', templateRef: '../../etc' });
  assert.equal(r.status, 400);
  ctx.teacher = t;
});

test('다른 교사는 남의 학급에 접근할 수 없다', async () => {
  const other = client();
  await other.post('/auth/register', { email: 'other@test.kr', password: 'password123', name: '다른', schoolCode: ctx.schoolCode });
  const r = await other.get(`/classes/${ctx.klass.id}`);
  assert.equal(r.status, 403);
  ctx.other = other;
});

test('학생 로그인: 코드 → 목록 → PIN', async () => {
  const s = client();
  let r = await s.get(`/join/${ctx.klass.code.toLowerCase()}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.students.length, 3);
  assert.ok(!('pin' in r.data.students[0]));
  const kid = ctx.students[0];
  const wrong = kid.pin === '0000' ? '1111' : '0000';
  r = await s.post('/auth/student-login', { code: ctx.klass.code, studentId: kid.id, pin: wrong });
  assert.equal(r.status, 401);
  r = await s.post('/auth/student-login', { code: ctx.klass.code, studentId: kid.id, pin: kid.pin });
  assert.equal(r.status, 200);
  r = await s.get('/auth/me');
  assert.equal(r.data.kind, 'student');
  assert.equal(r.data.student.name, '김하늘');
  r = await s.get('/student/home');
  assert.equal(r.data.assignments.length, 1);
  ctx.kid = s;

  // 학생은 교사 API를 쓸 수 없다
  r = await s.get(`/classes/${ctx.klass.id}`);
  assert.equal(r.status, 401);
});

test('학생 작품 임시저장 → 제출 → 교사 피드백·전시 → 학생 확인', async () => {
  const s = ctx.kid;
  let r = await s.post('/artworks', { title: '내 고양이', width: 1600, height: 1200, templateRef: 'builtin:cat', assignmentId: ctx.assignment.id, image: PNG, thumb: PNG, draft: { version: 1, layers: [] }, stats: { strokeCount: 3 }, submit: false });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'draft');
  const id = r.data.id;
  r = await s.get(`/artworks/${id}/draft`);
  assert.deepEqual(r.data.draft, { version: 1, layers: [] });
  r = await s.put(`/artworks/${id}`, { image: PNG, thumb: PNG, submit: true });
  assert.equal(r.data.status, 'submitted');
  r = await s.post('/artworks', { width: 1600, height: 1200, image: 'data:text/html;base64,PGh0bWw+', submit: true });
  assert.equal(r.status, 400);

  const t = ctx.teacher;
  r = await t.get(`/classes/${ctx.klass.id}/artworks?unreviewed=1`);
  assert.equal(r.data.length, 1);
  r = await t.get(`/assignments/${ctx.assignment.id}/status`);
  assert.equal(r.data.students.filter((x) => x.artwork_id).length, 1);
  r = await t.post(`/artworks/${id}/feedback`, { stamp: '참 잘했어요', comment: '색이 정말 예뻐요!' });
  assert.equal(r.data.length, 1);
  r = await t.post(`/artworks/${id}/feedback`, { stamp: '가짜 도장' });
  assert.equal(r.status, 400);
  r = await t.post(`/artworks/${id}/exhibit`, { exhibited: true });
  assert.equal(r.status, 200);
  r = await t.get(`/artworks/${id}/image`);
  assert.equal(r.status, 200);

  r = await ctx.other.get(`/artworks/${id}/image`);
  assert.equal(r.status, 403);

  r = await s.get('/student/home');
  assert.equal(r.data.newFeedback, 1);
  r = await s.get(`/artworks/${id}`);
  assert.equal(r.data.feedback[0].stamp, '참 잘했어요');
  r = await s.get('/student/gallery');
  assert.equal(r.data.length, 1);
  // 제출한 작품은 학생이 지울 수 없다
  r = await s.del(`/artworks/${id}`);
  assert.equal(r.status, 400);
  ctx.artworkId = id;
});

test('같은 반 친구는 전시작만 볼 수 있다', async () => {
  const friend = client();
  const kid = ctx.students[1];
  await friend.post('/auth/student-login', { code: ctx.klass.code, studentId: kid.id, pin: kid.pin });
  let r = await friend.get(`/artworks/${ctx.artworkId}/image?thumb=1`);
  assert.equal(r.status, 200);
  await ctx.teacher.post(`/artworks/${ctx.artworkId}/exhibit`, { exhibited: false });
  r = await friend.get(`/artworks/${ctx.artworkId}/image?thumb=1`);
  assert.equal(r.status, 403);
});

test('그림 마음 탐색: 열기 → 학생 응시 → 리포트', async () => {
  const t = ctx.teacher;
  let r = await t.post(`/classes/${ctx.klass.id}/psych`, { title: '11월 마음 탐색' });
  const cid = r.data.id;
  const s = ctx.kid;
  r = await s.get('/student/home');
  assert.equal(r.data.psych.length, 1);
  const drawing = { image: PNG, thumb: PNG, stats: { strokeCount: 40, activeMs: 120000, colors: ['#222222', '#e53935', '#43a047'], darkStrokeRatio: 0.3, warmStrokeRatio: 0.4, pixel: { inkRatio: 0.1, bboxRatio: 0.3, centroid: { x: 0.5, y: 0.5 } } } };
  r = await s.post(`/student/psych/${cid}/submit`, {
    answers: { h1: 'family', h2: 'warm', h3: '거실', t1: 'adult', t2: 'good', t3: ['flowers', 'bogus'], t4: 'enough', p1: 'me', p2: 'great', s1: 'sunny', s2: 'yes', s3: 'yes', s4: 'no', s5: 'yes', s6: 'yes', s7: 'yes', evil: 'x' },
    drawings: { house: drawing, tree: drawing, person: drawing },
  });
  assert.equal(r.status, 200);
  assert.ok(r.data.kid.points.length > 0);
  r = await s.post(`/student/psych/${cid}/submit`, { answers: {}, drawings: { house: drawing, tree: drawing, person: drawing } });
  assert.equal(r.status, 409);

  r = await t.get(`/psych/campaigns/${cid}/report`);
  assert.equal(r.data.summary.completed, 1);
  assert.equal(r.data.summary.total, 3);
  const resultId = r.data.students.find((x) => x.result).result.id;
  r = await t.get(`/psych/results/${resultId}`);
  assert.deepEqual(r.data.answers.t3, ['flowers']);
  assert.ok(!('evil' in r.data.answers));
  assert.equal(r.data.report.attention.level, 'none');
  r = await t.get(`/psych/results/${resultId}/drawing/tree`);
  assert.equal(r.status, 200);
  r = await ctx.other.get(`/psych/results/${resultId}`);
  assert.equal(r.status, 403);
  // AI 키가 없으면 503
  r = await t.post(`/psych/results/${resultId}/ai-summary`);
  assert.equal(r.status, 503);
});

test('AI 도안: 키가 없으면 기본 도안을 추천', async () => {
  const r = await ctx.kid.post('/ai/sketch', { prompt: '고양이 그려줘' });
  assert.equal(r.status, 503);
  assert.ok(Array.isArray(r.data.suggestions));
  assert.ok(r.data.suggestions.includes('builtin:cat'));
});

test('나만의 도안 저장 · 권한', async () => {
  let r = await ctx.teacher.post('/templates', { title: '사진 도안', source: 'photo', image: PNG, thumb: PNG });
  const tid = r.data.id;
  assert.equal(r.data.ref, `t:${tid}`);
  r = await ctx.kid.get('/templates');
  assert.ok(r.data.some((t) => t.id === tid && !t.mine));
  r = await ctx.kid.get(`/templates/${tid}/image`);
  assert.equal(r.status, 200);
  r = await ctx.other.get(`/templates/${tid}/image`);
  assert.equal(r.status, 404);
  r = await ctx.kid.del(`/templates/${tid}`);
  assert.equal(r.status, 404);
});

test('PIN 재발급 시 기존 학생 세션 종료', async () => {
  const kid = ctx.students[0];
  const r = await ctx.teacher.patch(`/students/${kid.id}`, { resetPin: true });
  assert.notEqual(r.data.pin, undefined);
  const me = await ctx.kid.get('/auth/me');
  assert.equal(me.data.kind, null);
});
