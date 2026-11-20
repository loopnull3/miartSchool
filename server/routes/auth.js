import { Router } from 'express';
import { one, all, run } from '../db.js';
import {
  HttpError,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  checkRateLimit,
  clearRateLimit,
  requireUser,
} from '../auth.js';

const r = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.post('/auth/register', (req, res) => {
  const { email, password, name, schoolCode, schoolName } = req.body || {};
  checkRateLimit(`register:${req.ip}`, 20, 3600_000);
  if (!EMAIL_RE.test(String(email || ''))) throw new HttpError(400, '이메일 형식을 확인해 주세요.');
  if (String(password || '').length < 8) throw new HttpError(400, '비밀번호는 8자 이상이어야 합니다.');
  const cleanName = String(name || '').trim().slice(0, 40);
  if (!cleanName) throw new HttpError(400, '이름을 입력해 주세요.');
  if (one('SELECT id FROM users WHERE email = ?', email)) throw new HttpError(409, '이미 가입된 이메일입니다.');

  let school = null;
  const code = String(schoolCode || '').trim().toUpperCase();
  if (code) {
    school = one('SELECT * FROM schools WHERE invite_code = ? AND active = 1', code);
    if (!school) throw new HttpError(400, '학교 인증 코드가 올바르지 않습니다.');
  }
  const status = school ? 'active' : 'pending';
  const info = run(
    'INSERT INTO users (role, email, name, school_id, school_name, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'teacher',
    String(email).trim(),
    cleanName,
    school?.id ?? null,
    school?.name ?? (String(schoolName || '').trim().slice(0, 60) || null),
    hashPassword(String(password)),
    status,
  );
  if (status === 'active') createSession(res, 'user', Number(info.lastInsertRowid));
  res.json({ status });
});

r.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  checkRateLimit(`login:${String(email).toLowerCase()}`, 10, 10 * 60_000);
  const user = one('SELECT * FROM users WHERE email = ?', String(email || '').trim());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  if (user.status === 'pending') throw new HttpError(403, '관리자 승인을 기다리고 있어요. 승인 후 로그인할 수 있습니다.');
  if (user.status === 'disabled') throw new HttpError(403, '사용이 중지된 계정입니다. 관리자에게 문의하세요.');
  clearRateLimit(`login:${String(email).toLowerCase()}`);
  createSession(res, 'user', user.id);
  res.json({ ok: true, role: user.role });
});

r.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

r.post('/auth/password', (req, res) => {
  const user = requireUser(req);
  const { current, next } = req.body || {};
  const row = one('SELECT password_hash FROM users WHERE id = ?', user.id);
  if (!verifyPassword(String(current || ''), row.password_hash)) throw new HttpError(400, '현재 비밀번호가 올바르지 않습니다.');
  if (String(next || '').length < 8) throw new HttpError(400, '새 비밀번호는 8자 이상이어야 합니다.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(next)), user.id);
  res.json({ ok: true });
});

r.get('/auth/me', (req, res) => {
  const a = req.auth;
  if (!a) return res.json({ kind: null });
  if (a.kind === 'user') return res.json({ kind: 'user', user: a.user });
  res.json({
    kind: 'student',
    student: a.student,
    klass: { id: a.klass.id, name: a.klass.name, grade: a.klass.grade, ai_enabled: !!a.klass.ai_enabled, gallery_enabled: !!a.klass.gallery_enabled },
  });
});

// 학생 로그인 1단계: 학급 코드로 학급과 학생 목록 조회 (PIN 제외)
r.get('/join/:code', (req, res) => {
  checkRateLimit(`join:${req.ip}`, 60, 10 * 60_000);
  const code = String(req.params.code || '').trim().toUpperCase();
  const klass = one(
    `SELECT c.id, c.name, c.grade, u.name AS teacher_name, u.school_name
       FROM classes c JOIN users u ON u.id = c.teacher_id
      WHERE c.code = ? AND c.archived = 0 AND u.status = 'active'`,
    code,
  );
  if (!klass) throw new HttpError(404, '학급 코드를 찾을 수 없어요. 선생님께 코드를 다시 확인해 주세요.');
  const students = all('SELECT id, name, number, avatar FROM students WHERE class_id = ? ORDER BY number IS NULL, number, name', klass.id);
  res.json({ klass, students });
});

// 학생 로그인 2단계: 학생 선택 + PIN
r.post('/auth/student-login', (req, res) => {
  const { code, studentId, pin } = req.body || {};
  const sid = Number(studentId);
  checkRateLimit(`pin:${sid}`, 10, 10 * 60_000);
  const student = one(
    `SELECT s.* FROM students s JOIN classes c ON c.id = s.class_id
      WHERE s.id = ? AND c.code = ? AND c.archived = 0`,
    sid,
    String(code || '').trim().toUpperCase(),
  );
  if (!student || String(pin || '') !== student.pin) throw new HttpError(401, '비밀번호가 맞지 않아요. 다시 눌러 볼까요?');
  clearRateLimit(`pin:${sid}`);
  createSession(res, 'student', student.id);
  res.json({ ok: true });
});

export default r;
