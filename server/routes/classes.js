// 교사용: 학급 · 학생 · 과제 관리
import { Router } from 'express';
import { one, all, run, tx } from '../db.js';
import { HttpError, requireTeacher, requireOwnedClass, randomCode, randomPin, newAccessCode, randomPick } from '../auth.js';
import { ANIMALS, FRUITS } from '../../shared/login-pictures.js';

const r = Router();
const AVATARS = ['🐣', '🐰', '🐻', '🐼', '🦊', '🐯', '🐨', '🐸', '🐵', '🦁', '🐶', '🐱', '🐹', '🐧', '🦄', '🐙', '🐳', '🦖', '🐝', '🦋'];

function newStudentLogin() {
  return {
    access_code: newAccessCode((c) => !!one('SELECT id FROM students WHERE access_code = ?', c)),
    animal: randomPick(ANIMALS).key,
    fruit: randomPick(FRUITS).key,
  };
}

// 예전 데이터(PIN만 있던 학생)에 참여 코드 채우기
export function backfillStudentLogins() {
  for (const st of all('SELECT id FROM students WHERE access_code IS NULL OR animal IS NULL OR fruit IS NULL')) {
    const l = newStudentLogin();
    run('UPDATE students SET access_code = ?, animal = ?, fruit = ? WHERE id = ?', l.access_code, l.animal, l.fruit, st.id);
  }
}

function uniqueClassCode() {
  let code;
  do code = randomCode(6);
  while (one('SELECT id FROM classes WHERE code = ?', code));
  return code;
}

r.get('/classes', (req, res) => {
  const user = requireTeacher(req);
  const rows = all(
    `SELECT c.*,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count,
            (SELECT COUNT(*) FROM artworks a WHERE a.class_id = c.id AND a.status = 'submitted') AS artwork_count,
            (SELECT COUNT(*) FROM artworks a WHERE a.class_id = c.id AND a.status = 'submitted'
               AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.artwork_id = a.id)) AS unreviewed_count,
            (SELECT COUNT(*) FROM assignments g WHERE g.class_id = c.id AND g.status = 'open') AS open_assignments
       FROM classes c WHERE c.teacher_id = ? ORDER BY c.archived, c.created_at DESC`,
    user.id,
  );
  res.json(rows);
});

r.post('/classes', (req, res) => {
  const user = requireTeacher(req);
  const name = String(req.body?.name || '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, '학급 이름을 입력해 주세요.');
  const grade = String(req.body?.grade || '').trim().slice(0, 20) || null;
  const code = uniqueClassCode();
  const info = run('INSERT INTO classes (teacher_id, name, grade, code) VALUES (?, ?, ?, ?)', user.id, name, grade, code);
  res.json(one('SELECT * FROM classes WHERE id = ?', Number(info.lastInsertRowid)));
});

r.get('/classes/:id', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const students = all(
    `SELECT s.*,
            (SELECT COUNT(*) FROM artworks a WHERE a.student_id = s.id AND a.status = 'submitted') AS artwork_count
       FROM students s WHERE s.class_id = ? ORDER BY s.number IS NULL, s.number, s.name`,
    klass.id,
  );
  const assignments = all(
    `SELECT g.*,
            (SELECT COUNT(DISTINCT a.student_id) FROM artworks a WHERE a.assignment_id = g.id AND a.status = 'submitted') AS submitted_count
       FROM assignments g WHERE g.class_id = ? ORDER BY g.status = 'closed', g.created_at DESC`,
    klass.id,
  );
  res.json({ klass, students, assignments });
});

r.patch('/classes/:id', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim().slice(0, 40) : klass.name;
  if (!name) throw new HttpError(400, '학급 이름을 입력해 주세요.');
  run(
    'UPDATE classes SET name = ?, grade = ?, ai_enabled = ?, gallery_enabled = ?, archived = ?, checkin_enabled = ? WHERE id = ?',
    name,
    b.grade != null ? String(b.grade).trim().slice(0, 20) || null : klass.grade,
    b.ai_enabled != null ? (b.ai_enabled ? 1 : 0) : klass.ai_enabled,
    b.gallery_enabled != null ? (b.gallery_enabled ? 1 : 0) : klass.gallery_enabled,
    b.archived != null ? (b.archived ? 1 : 0) : klass.archived,
    b.checkin_enabled != null ? (b.checkin_enabled ? 1 : 0) : klass.checkin_enabled,
    klass.id,
  );
  res.json(one('SELECT * FROM classes WHERE id = ?', klass.id));
});

r.post('/classes/:id/regenerate-code', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const code = uniqueClassCode();
  run('UPDATE classes SET code = ? WHERE id = ?', code, klass.id);
  res.json({ code });
});

r.delete('/classes/:id', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  if (req.body?.confirm !== klass.name) throw new HttpError(400, '삭제하려면 학급 이름을 정확히 입력해 주세요.');
  run('DELETE FROM classes WHERE id = ?', klass.id);
  res.json({ ok: true });
});

// 학생 일괄 등록: names = ["1 김하늘", "2 이바다", "박구름"]
r.post('/classes/:id/students', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const lines = Array.isArray(req.body?.names) ? req.body.names : String(req.body?.names || '').split(/\r?\n/);
  const parsed = [];
  for (const raw of lines) {
    const line = String(raw).trim();
    if (!line) continue;
    const m = /^(\d{1,3})[.)\s]+(.+)$/.exec(line);
    const number = m ? Number(m[1]) : null;
    const name = (m ? m[2] : line).trim().slice(0, 20);
    if (name) parsed.push({ number, name });
  }
  if (!parsed.length) throw new HttpError(400, '학생 이름을 한 줄에 한 명씩 입력해 주세요.');
  const existing = one('SELECT COUNT(*) n FROM students WHERE class_id = ?', klass.id).n;
  if (existing + parsed.length > 60) throw new HttpError(400, '한 학급에는 학생을 60명까지 등록할 수 있습니다.');
  const created = tx(() =>
    parsed.map((p, i) => {
      const avatar = AVATARS[(existing + i) % AVATARS.length];
      const l = newStudentLogin();
      const info = run(
        'INSERT INTO students (class_id, name, number, pin, avatar, access_code, animal, fruit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        klass.id,
        p.name,
        p.number,
        randomPin(),
        avatar,
        l.access_code,
        l.animal,
        l.fruit,
      );
      return one('SELECT * FROM students WHERE id = ?', Number(info.lastInsertRowid));
    }),
  );
  res.json(created);
});

function ownedStudent(req, id) {
  const student = one('SELECT * FROM students WHERE id = ?', Number(id));
  if (!student) throw new HttpError(404, '학생을 찾을 수 없습니다.');
  requireOwnedClass(req, student.class_id);
  return student;
}

r.patch('/students/:id', (req, res) => {
  const s = ownedStudent(req, req.params.id);
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim().slice(0, 20) : s.name;
  if (!name) throw new HttpError(400, '이름을 입력해 주세요.');
  const number = b.number === '' || b.number === null ? null : b.number != null ? Number(b.number) : s.number;
  const avatar = b.avatar && AVATARS.includes(b.avatar) ? b.avatar : s.avatar;
  let { access_code: code, animal, fruit } = s;
  if (b.resetLogin) ({ access_code: code, animal, fruit } = newStudentLogin());
  if (b.animal != null) {
    if (!ANIMALS.some((a) => a.key === b.animal)) throw new HttpError(400, '동물 값이 올바르지 않습니다.');
    animal = b.animal;
  }
  if (b.fruit != null) {
    if (!FRUITS.some((f) => f.key === b.fruit)) throw new HttpError(400, '과일 값이 올바르지 않습니다.');
    fruit = b.fruit;
  }
  run(
    'UPDATE students SET name = ?, number = ?, avatar = ?, access_code = ?, animal = ?, fruit = ? WHERE id = ?',
    name,
    Number.isFinite(number) ? number : null,
    avatar,
    code,
    animal,
    fruit,
    s.id,
  );
  if (b.resetLogin || animal !== s.animal || fruit !== s.fruit) run("DELETE FROM sessions WHERE kind = 'student' AND subject_id = ?", s.id);
  res.json(one('SELECT * FROM students WHERE id = ?', s.id));
});

r.delete('/students/:id', (req, res) => {
  const s = ownedStudent(req, req.params.id);
  run('DELETE FROM students WHERE id = ?', s.id);
  run("DELETE FROM sessions WHERE kind = 'student' AND subject_id = ?", s.id);
  res.json({ ok: true });
});

r.get('/avatars', (_req, res) => res.json(AVATARS));

// 과제
function validTemplateRef(ref) {
  if (ref == null || ref === '') return null;
  const s = String(ref);
  if (/^builtin:[a-z0-9-]+$/.test(s) || /^t:\d+$/.test(s)) return s;
  throw new HttpError(400, '도안 정보가 올바르지 않습니다.');
}

const TECHNIQUES = ['watercolor', 'oil'];
const PAPERS = ['white', 'ivory', 'kraft', 'black', 'watercolor', 'canvas'];

function cleanDateTime(v) {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, '날짜 형식이 올바르지 않습니다.');
  return d.toISOString();
}

function cleanSteps(v) {
  if (!Array.isArray(v)) return null;
  const steps = v.map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 12);
  return steps.length ? JSON.stringify(steps) : null;
}

export function cleanMaterials(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const m of v.slice(0, 10)) {
    const url = String(m?.url || '').trim();
    if (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 500) continue;
    const type = ['youtube', 'link', 'image'].includes(m.type) ? m.type : /youtu\.?be/.test(url) ? 'youtube' : 'link';
    out.push({ type, title: String(m.title || '').trim().slice(0, 60) || '수업 자료', url });
  }
  return out.length ? JSON.stringify(out) : null;
}

export function createAssignment(classId, b) {
  const title = String(b.title || '').trim().slice(0, 60);
  if (!title) throw new HttpError(400, '과제 제목을 입력해 주세요.');
  const startAt = cleanDateTime(b.startAt);
  const endAt = cleanDateTime(b.endAt);
  if (startAt && endAt && endAt <= startAt) throw new HttpError(400, '마감 시간은 시작 시간보다 뒤여야 합니다.');
  const info = run(
    `INSERT INTO assignments (class_id, title, description, template_ref, orientation, due_date, start_at, end_at, technique, paper, steps_json, materials_json, lesson_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    classId,
    title,
    String(b.description || '').trim().slice(0, 1000) || null,
    validTemplateRef(b.templateRef),
    b.orientation === 'portrait' ? 'portrait' : 'landscape',
    endAt ? endAt.slice(0, 10) : null,
    startAt,
    endAt,
    TECHNIQUES.includes(b.technique) ? b.technique : 'watercolor',
    PAPERS.includes(b.paper) ? b.paper : null,
    cleanSteps(b.steps),
    cleanMaterials(b.materials),
    b.lessonId ? String(b.lessonId).slice(0, 60) : null,
  );
  return one('SELECT * FROM assignments WHERE id = ?', Number(info.lastInsertRowid));
}

r.post('/classes/:id/assignments', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  res.json(createAssignment(klass.id, req.body || {}));
});

function ownedAssignment(req, id) {
  const g = one('SELECT * FROM assignments WHERE id = ?', Number(id));
  if (!g) throw new HttpError(404, '과제를 찾을 수 없습니다.');
  requireOwnedClass(req, g.class_id);
  return g;
}

r.patch('/assignments/:id', (req, res) => {
  const g = ownedAssignment(req, req.params.id);
  const b = req.body || {};
  const startAt = b.startAt !== undefined ? cleanDateTime(b.startAt) : g.start_at;
  const endAt = b.endAt !== undefined ? cleanDateTime(b.endAt) : g.end_at;
  if (startAt && endAt && endAt <= startAt) throw new HttpError(400, '마감 시간은 시작 시간보다 뒤여야 합니다.');
  run(
    `UPDATE assignments SET title = ?, description = ?, status = ?, template_ref = ?, start_at = ?, end_at = ?, due_date = ?,
            technique = ?, paper = ?, steps_json = ?, materials_json = ? WHERE id = ?`,
    b.title != null ? String(b.title).trim().slice(0, 60) || g.title : g.title,
    b.description != null ? String(b.description).trim().slice(0, 1000) || null : g.description,
    b.status === 'closed' || b.status === 'open' ? b.status : g.status,
    b.templateRef !== undefined ? validTemplateRef(b.templateRef) : g.template_ref,
    startAt,
    endAt,
    endAt ? endAt.slice(0, 10) : null,
    TECHNIQUES.includes(b.technique) ? b.technique : g.technique,
    b.paper !== undefined ? (PAPERS.includes(b.paper) ? b.paper : null) : g.paper,
    b.steps !== undefined ? cleanSteps(b.steps) : g.steps_json,
    b.materials !== undefined ? cleanMaterials(b.materials) : g.materials_json,
    g.id,
  );
  res.json(one('SELECT * FROM assignments WHERE id = ?', g.id));
});

r.delete('/assignments/:id', (req, res) => {
  const g = ownedAssignment(req, req.params.id);
  run('DELETE FROM assignments WHERE id = ?', g.id);
  res.json({ ok: true });
});

// 과제별 제출 현황
r.get('/assignments/:id/status', (req, res) => {
  const g = ownedAssignment(req, req.params.id);
  const rows = all(
    `SELECT s.id, s.name, s.number, s.avatar,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = ? AND a.student_id = s.id AND a.status = 'submitted' ORDER BY a.submitted_at DESC LIMIT 1) AS artwork_id
       FROM students s WHERE s.class_id = ? ORDER BY s.number IS NULL, s.number, s.name`,
    g.id,
    g.class_id,
  );
  res.json({ assignment: g, students: rows });
});

export default r;
