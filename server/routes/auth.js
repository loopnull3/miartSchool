import crypto from 'node:crypto';
import { Router } from 'express';
import { one, run } from '../db.js';
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

// 선생님은 이메일만 입력해서 로그인한다 (TEACHER_EMAIL_LOGIN=false 이면 비밀번호도 받음). 관리자는 항상 비밀번호.
export const teacherEmailOnly = () => process.env.TEACHER_EMAIL_LOGIN !== 'false';

r.get('/auth/config', (_req, res) => res.json({ teacherEmailOnly: teacherEmailOnly() }));

r.post('/auth/register', (req, res) => {
  const { email, password, name, schoolCode, schoolName } = req.body || {};
  checkRateLimit(`register:${req.ip}`, 20, 3600_000);
  if (!EMAIL_RE.test(String(email || ''))) throw new HttpError(400, '이메일 형식을 확인해 주세요.');
  const emailOnly = teacherEmailOnly();
  if ((!emailOnly || password) && String(password || '').length < 8) throw new HttpError(400, '비밀번호는 8자 이상이어야 합니다.');
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
    // 이메일만 쓰는 경우에도 칸은 채워 둔다 (아무도 모르는 무작위 비밀번호)
    hashPassword(password ? String(password) : crypto.randomUUID()),
    status,
  );
  if (status === 'active') createSession(res, 'user', Number(info.lastInsertRowid));
  res.json({ status });
});

r.post('/auth/login', (req, res) => {
  const { password } = req.body || {};
  const email = String(req.body?.email || '').trim();
  checkRateLimit(`login-ip:${req.ip}`, 60, 10 * 60_000);
  checkRateLimit(`login:${email.toLowerCase()}`, 10, 10 * 60_000);
  if (!EMAIL_RE.test(email)) throw new HttpError(400, '이메일 형식을 확인해 주세요.');
  const user = one('SELECT * FROM users WHERE email = ?', email);
  if (teacherEmailOnly() && !password) {
    if (!user) throw new HttpError(401, '등록된 선생님 이메일이 아니에요. 처음이면 가입 신청을 해 주세요.');
    if (user.role !== 'teacher') throw new HttpError(401, '관리자 계정은 비밀번호도 입력해 주세요.', { needPassword: true });
  } else if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  if (user.status === 'pending') throw new HttpError(403, '관리자 승인을 기다리고 있어요. 승인 후 로그인할 수 있습니다.');
  if (user.status === 'disabled') throw new HttpError(403, '사용이 중지된 계정입니다. 관리자에게 문의하세요.');
  clearRateLimit(`login:${email.toLowerCase()}`);
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
    klass: {
      id: a.klass.id,
      name: a.klass.name,
      grade: a.klass.grade,
      ai_enabled: !!a.klass.ai_enabled,
      gallery_enabled: !!a.klass.gallery_enabled,
      checkin_enabled: !!a.klass.checkin_enabled,
    },
  });
});

// 학생 로그인 1단계: 개인 참여 코드(또는 QR) 확인 → 이름·아바타만 알려 준다
function studentByCode(code) {
  return one(
    `SELECT s.*, c.name AS class_name FROM students s JOIN classes c ON c.id = s.class_id
       JOIN users u ON u.id = c.teacher_id
      WHERE s.access_code = ? AND c.archived = 0 AND u.status = 'active'`,
    String(code || '').trim().toUpperCase(),
  );
}

r.post('/auth/student/code', (req, res) => {
  checkRateLimit(`code:${req.ip}`, 40, 10 * 60_000);
  const s = studentByCode(req.body?.code);
  if (!s) throw new HttpError(404, '참여 코드를 찾을 수 없어요. 선생님께 받은 카드를 다시 확인해 주세요.');
  res.json({ student: { name: s.name, avatar: s.avatar, className: s.class_name } });
});

// 학생 로그인 2단계: 동물 + 과일
r.post('/auth/student/login', (req, res) => {
  const s = studentByCode(req.body?.code);
  if (!s) throw new HttpError(404, '참여 코드를 찾을 수 없어요.');
  checkRateLimit(`pic:${s.id}`, 8, 10 * 60_000);
  if (String(req.body?.animal || '') !== s.animal || String(req.body?.fruit || '') !== s.fruit) {
    throw new HttpError(401, '동물이나 과일이 맞지 않아요. 카드를 보고 다시 골라 볼까요?');
  }
  clearRateLimit(`pic:${s.id}`);
  createSession(res, 'student', s.id);
  res.json({ ok: true });
});

export default r;
