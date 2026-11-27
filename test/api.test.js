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
const { createApp, ensureAdmin, ensureInitialTeachers } = await import('../server/index.js');

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

test('학생 로그인: 참여 코드 → 동물 → 과일', async () => {
  const s = client();
  const kid = ctx.students[0];
  assert.match(kid.access_code, /^[A-Z0-9]{6}$/);
  let r = await s.post('/auth/student/code', { code: kid.access_code.toLowerCase() });
  assert.equal(r.status, 200);
  assert.equal(r.data.student.name, '김하늘');
  assert.ok(!('animal' in r.data.student) && !('fruit' in r.data.student));
  r = await s.post('/auth/student/code', { code: 'ZZZZZZ' });
  assert.equal(r.status, 404);
  const wrongFruit = kid.fruit === 'apple' ? 'banana' : 'apple';
  r = await s.post('/auth/student/login', { code: kid.access_code, animal: kid.animal, fruit: wrongFruit });
  assert.equal(r.status, 401);
  r = await s.post('/auth/student/login', { code: kid.access_code, animal: kid.animal, fruit: kid.fruit });
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

test('그림 비밀번호는 학급 공통: 모두 같고, 학급에서 바꾸면 모두 바뀐다', async () => {
  const t = ctx.teacher;
  let r = await t.get(`/classes/${ctx.klass.id}`);
  const { klass, students } = r.data;
  assert.ok(klass.login_animal && klass.login_fruit);
  assert.ok(students.every((x) => x.animal === klass.login_animal && x.fruit === klass.login_fruit));
  assert.equal(new Set(students.map((x) => x.access_code)).size, students.length, '참여 코드는 학생마다 다르다');
  // 학생 한 명만 바꾸는 것은 막는다
  r = await t.patch(`/students/${students[0].id}`, { animal: 'cat' });
  assert.equal(r.status, 400);
  // 학급에서 직접 고르기
  const animal = klass.login_animal === 'panda' ? 'pig' : 'panda';
  r = await t.patch(`/classes/${ctx.klass.id}`, { loginAnimal: animal, loginFruit: 'peach' });
  assert.equal(r.status, 200);
  assert.equal(r.data.login_animal, animal);
  r = await t.get(`/classes/${ctx.klass.id}`);
  assert.ok(r.data.students.every((x) => x.animal === animal && x.fruit === 'peach'));
  const kidClient = client();
  r = await kidClient.post('/auth/student/login', { code: students[1].access_code, animal, fruit: 'peach' });
  assert.equal(r.status, 200);
  // 새로 뽑기는 이전과 다른 조합
  r = await t.patch(`/classes/${ctx.klass.id}`, { resetLoginPicture: true });
  assert.ok(r.data.login_animal !== animal || r.data.login_fruit !== 'peach');
  r = await t.patch(`/classes/${ctx.klass.id}`, { loginAnimal: 'zebra' });
  assert.equal(r.status, 400);
  // 새로 등록한 학생도 학급 그림을 따른다
  const cur = (await t.get(`/classes/${ctx.klass.id}`)).data.klass;
  r = await t.post(`/classes/${ctx.klass.id}/students`, { names: '99 새친구' });
  assert.equal(r.data[0].animal, cur.login_animal);
  assert.equal(r.data[0].fruit, cur.login_fruit);
  // 참여 코드 재발급은 코드만 바뀐다
  const before = r.data[0];
  r = await t.patch(`/students/${before.id}`, { resetLogin: true });
  assert.notEqual(r.data.access_code, before.access_code);
  assert.equal(r.data.animal, cur.login_animal);
  await t.del(`/students/${before.id}`);
  ctx.students = (await t.get(`/classes/${ctx.klass.id}`)).data.students;
});

test('그림 비밀번호를 계속 틀리면 잠시 잠긴다', async () => {
  const s = client();
  const kid = ctx.students[2];
  const wrong = kid.animal === 'dog' ? 'cat' : 'dog';
  let last;
  for (let i = 0; i < 9; i++) last = await s.post('/auth/student/login', { code: kid.access_code, animal: wrong, fruit: kid.fruit });
  assert.equal(last.status, 429);
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
  await friend.post('/auth/student/login', { code: kid.access_code, animal: kid.animal, fruit: kid.fruit });
  ctx.friend = friend;
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

test('과제 기간: 시작 전 과제는 학생에게 보이지 않고, 마감 지나면 닫힘', async () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();
  let r = await ctx.teacher.post(`/classes/${ctx.klass.id}/assignments`, { title: '내일 과제', startAt: future, technique: 'oil', paper: 'canvas', steps: ['하늘 칠하기', ''], materials: [{ type: 'youtube', title: '영상', url: 'https://youtu.be/abc' }, { url: 'javascript:alert(1)' }] });
  assert.equal(r.data.technique, 'oil');
  assert.equal(JSON.parse(r.data.materials_json).length, 1);
  assert.deepEqual(JSON.parse(r.data.steps_json), ['하늘 칠하기']);
  await ctx.teacher.post(`/classes/${ctx.klass.id}/assignments`, { title: '지난 과제', startAt: new Date(Date.now() - 2 * 86400_000).toISOString(), endAt: past });
  r = await ctx.teacher.post(`/classes/${ctx.klass.id}/assignments`, { title: '잘못된 기간', startAt: future, endAt: past });
  assert.equal(r.status, 400);
  r = await ctx.friend.get('/student/assignments');
  const tomorrow = r.data.find((g) => g.title === '내일 과제');
  assert.equal(tomorrow.not_started, true);
  r = await ctx.friend.get(`/student/assignments/${tomorrow.id}`);
  assert.equal(r.status, 403);
  r = await ctx.friend.get('/student/assignments');
  assert.ok(r.data.find((g) => g.title === '지난 과제').closed);
  r = await ctx.friend.get('/student/home');
  assert.ok(!r.data.assignments.some((g) => g.title === '지난 과제'));
});

test('마음 날씨 체크인: 학생 기록 → 교사 월별 조회', async () => {
  let r = await ctx.friend.post('/student/checkin', { weather: 'rain', emotions: ['sad', 'tired', 'worried', 'angry', 'bogus'], causes: ['friend', 'x'], note: '친구랑 다퉜어요' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.emotions, ['sad', 'tired', 'worried']);
  assert.deepEqual(r.data.causes, ['friend']);
  r = await ctx.friend.post('/student/checkin', { weather: 'sunny', emotions: ['happy'] });
  assert.equal(r.data.weather, 'sunny');
  r = await ctx.friend.post('/student/checkin', { weather: 'hail' });
  assert.equal(r.status, 400);
  r = await ctx.friend.get('/student/checkin');
  assert.equal(r.data.entry.weather, 'sunny');
  r = await ctx.teacher.get(`/classes/${ctx.klass.id}/checkins`);
  assert.equal(r.data.entries.length, 1);
  assert.equal(r.data.entries[0].note, null);
  r = await ctx.other.get(`/classes/${ctx.klass.id}/checkins`);
  assert.equal(r.status, 403);
  await ctx.teacher.patch(`/classes/${ctx.klass.id}`, { checkin_enabled: false });
  r = await ctx.friend.post('/student/checkin', { weather: 'sunny' });
  assert.equal(r.status, 403);
  await ctx.teacher.patch(`/classes/${ctx.klass.id}`, { checkin_enabled: true });
});

test('갤러리보드: 반 보드 · 학교 보드 · 게시물 · 좋아요 · 권한', async () => {
  let r = await ctx.teacher.post('/boards', { title: '우리 반 전시회', scope: 'class', classId: ctx.klass.id });
  const classBoard = r.data;
  r = await ctx.teacher.post('/boards', { title: '미아트초 겨울 전시', scope: 'school' });
  const schoolBoard = r.data;
  assert.equal(schoolBoard.scope, 'school');
  r = await ctx.other.post('/boards', { title: '남의 반', scope: 'class', classId: ctx.klass.id });
  assert.equal(r.status, 400);
  // 같은 학교 다른 선생님은 학교 보드는 보지만 반 보드는 못 봄
  r = await ctx.other.get('/boards');
  assert.ok(r.data.some((b) => b.id === schoolBoard.id));
  assert.ok(!r.data.some((b) => b.id === classBoard.id));
  // 학생: 자기 작품 올리기
  r = await ctx.friend.post('/artworks', { width: 800, height: 600, image: PNG, thumb: PNG, submit: true, title: '눈사람' });
  const art = r.data.id;
  r = await ctx.friend.post(`/boards/${classBoard.id}/posts`, { artworkId: art, title: '눈사람', body: '친구들 보세요!' });
  assert.equal(r.status, 200);
  const post = r.data;
  assert.equal(post.mine, true);
  r = await ctx.friend.post(`/boards/${classBoard.id}/posts`, { artworkId: ctx.artworkId });
  assert.equal(r.status, 403);
  r = await ctx.kid.post(`/posts/${post.id}/like`);
  assert.equal(r.data.likes, 1);
  assert.equal(r.data.liked, true);
  r = await ctx.kid.get(`/boards/${classBoard.id}`);
  assert.equal(r.data.posts.length, 1);
  assert.equal(r.data.posts[0].mine, false);
  r = await ctx.kid.get(`/posts/${post.id}/image?thumb=1`);
  assert.equal(r.status, 200);
  r = await ctx.kid.del(`/posts/${post.id}`);
  assert.equal(r.status, 403);
  r = await ctx.other.get(`/posts/${post.id}/image`);
  assert.equal(r.status, 404);
  // 학생 게시 막기
  await ctx.teacher.patch(`/boards/${classBoard.id}`, { studentPosts: false });
  r = await ctx.friend.post(`/boards/${classBoard.id}/posts`, { artworkId: art });
  assert.equal(r.status, 403);
  // 교사는 사진 업로드 가능, 학생 글 삭제 가능
  r = await ctx.teacher.post(`/boards/${schoolBoard.id}/posts`, { image: PNG, title: '종이 작품 사진' });
  assert.equal(r.status, 200);
  r = await ctx.teacher.del(`/posts/${post.id}`);
  assert.equal(r.status, 200);
});

test('수업 자료 → 내 수업 저장 → 학급에서 시작', async () => {
  const t = ctx.teacher;
  let r = await t.get('/lessons');
  assert.equal(r.status, 200);
  let lessonId = r.data[0]?.id;
  let my;
  if (lessonId) {
    r = await t.post('/my-lessons', { lessonId });
    my = r.data.id;
    r = await t.post('/my-lessons', { lessonId });
    assert.equal(r.data.existed, true);
  } else {
    r = await t.post('/my-lessons', { data: { title: '직접 만든 수업', steps: ['그리기'] } });
    my = r.data.id;
  }
  r = await t.patch(`/my-lessons/${my}`, { title: '바꾼 제목', materials: [{ url: 'https://example.com/a', title: '참고' }] });
  assert.equal(r.data.title, '바꾼 제목');
  r = await t.post(`/my-lessons/${my}/start`, { classId: ctx.klass.id });
  assert.equal(r.status, 200);
  assert.equal(r.data.title, '바꾼 제목');
  assert.equal(r.data.lesson_id, `my:${my}`);
  r = await ctx.other.get(`/my-lessons/${my}`);
  assert.equal(r.status, 404);
  r = await ctx.other.post(`/my-lessons/${my}/start`, { classId: ctx.klass.id });
  assert.equal(r.status, 404);
});

test('공개 사이트 API · 문의 · 후기', async () => {
  const anon = client();
  let r = await anon.get('/public/site');
  assert.ok(r.data.stats.teachers >= 2);
  assert.ok(r.data.stats.artworks >= 1);
  r = await anon.post('/public/inquiries', { type: 'purchase', name: '홍길동', email: 'a@b.kr', school: '미아트초', teachers: 7 });
  assert.equal(r.status, 200);
  r = await anon.post('/public/inquiries', { type: 'idea', name: '홍길동', email: 'bad' });
  assert.equal(r.status, 400);
  r = await ctx.admin.get('/admin/inquiries');
  assert.equal(r.data[0].teachers, 7);
  r = await ctx.admin.post('/admin/testimonials', { quote: '좋아요', name: '김*수 선생님', role: '초등 3학년' });
  assert.equal(r.status, 200);
  r = await anon.get('/public/site');
  assert.equal(r.data.testimonials[0].quote, '좋아요');
  r = await ctx.teacher.get('/admin/inquiries');
  assert.equal(r.status, 403);
});

test('로그인 정보 재발급 시 기존 학생 세션 종료', async () => {
  const kid = ctx.students[0];
  const r = await ctx.teacher.patch(`/students/${kid.id}`, { resetLogin: true });
  assert.notEqual(r.data.access_code, kid.access_code);
  const me = await ctx.kid.get('/auth/me');
  assert.equal(me.data.kind, null);
});

test('선생님은 이메일만으로 로그인, 관리자는 비밀번호 필요', async () => {
  const t = client();
  let r = await t.post('/auth/register', { email: 'easy@test.kr', name: '이메일 선생님', schoolCode: ctx.schoolCode });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'active');
  const t2 = client();
  r = await t2.post('/auth/login', { email: ' EASY@test.kr ' });
  assert.equal(r.status, 200);
  r = await t2.get('/auth/me');
  assert.equal(r.data.user.email, 'easy@test.kr');
  // 없는 이메일
  r = await client().post('/auth/login', { email: 'nobody@test.kr' });
  assert.equal(r.status, 401);
  // 승인 대기 선생님은 이메일만으로도 못 들어온다
  await client().post('/auth/register', { email: 'wait@test.kr', name: '대기', schoolName: '어딘가' });
  r = await client().post('/auth/login', { email: 'wait@test.kr' });
  assert.equal(r.status, 403);
  // 관리자는 비밀번호가 필요하다
  r = await client().post('/auth/login', { email: 'root@test.kr' });
  assert.equal(r.status, 401);
  assert.equal(r.data.needPassword, true);
  // 설정으로 끄면 비밀번호를 다시 받는다
  process.env.TEACHER_EMAIL_LOGIN = 'false';
  r = await client().post('/auth/login', { email: 'easy@test.kr' });
  assert.equal(r.status, 401);
  r = await client().get('/auth/config');
  assert.equal(r.data.teacherEmailOnly, false);
  delete process.env.TEACHER_EMAIL_LOGIN;
});

test('처음 실행 시 범어초 최규민 선생님 계정이 만들어지고, 관리자가 이메일을 바꿀 수 있다', async () => {
  ensureInitialTeachers();
  ensureInitialTeachers(); // 두 번 실행해도 하나만
  const admin = ctx.admin;
  let r = await admin.get('/admin/teachers');
  const list = r.data.filter((u) => u.name === '최규민');
  assert.equal(list.length, 1);
  assert.equal(list[0].school_name, '범어초등학교');
  assert.equal(list[0].status, 'active');
  r = await admin.get('/admin/schools');
  assert.ok(r.data.some((x) => x.name === '범어초등학교' && /^[A-Z0-9]{8}$/.test(x.invite_code)));
  const k = client();
  r = await k.post('/auth/login', { email: 'kyumin@miart.school' });
  assert.equal(r.status, 200);
  // 관리자가 이메일을 바꾸면 예전 이메일과 예전 로그인은 끊긴다
  r = await admin.patch(`/admin/teachers/${list[0].id}`, { email: 'kyumin.choi@beomeo.kr' });
  assert.equal(r.status, 200);
  r = await k.get('/auth/me');
  assert.equal(r.data.kind, null);
  r = await client().post('/auth/login', { email: 'kyumin@miart.school' });
  assert.equal(r.status, 401);
  r = await client().post('/auth/login', { email: 'kyumin.choi@beomeo.kr' });
  assert.equal(r.status, 200);
  r = await admin.patch(`/admin/teachers/${list[0].id}`, { email: 'easy@test.kr' });
  assert.equal(r.status, 409);
  // 빈 값이면 만들지 않는다
  ensureInitialTeachers('');
});
