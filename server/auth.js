// 인증: 교사/관리자(이메일+비밀번호), 학생(학급코드+이름+PIN)
import crypto from 'node:crypto';
import { one, run } from './db.js';

const SESSION_COOKIE = 'miart_sid';
const USER_TTL_MS = 14 * 24 * 3600 * 1000; // 교사 14일
const STUDENT_TTL_MS = 12 * 3600 * 1000; // 학생 12시간 (교실 공용 기기 고려)

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return crypto.timingSafeEqual(expected, actual);
}

// 혼동되는 글자(0/O, 1/I/L)를 뺀 코드 문자
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// 학생 개인 참여 코드 (전체에서 유일)
export function newAccessCode(exists) {
  let code;
  do code = randomCode(6);
  while (exists(code));
  return code;
}

export function randomPick(list) {
  return list[crypto.randomInt(0, list.length)];
}

export function randomPin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

export function createSession(res, kind, subjectId) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = kind === 'student' ? STUDENT_TTL_MS : USER_TTL_MS;
  run('INSERT INTO sessions (token, kind, subject_id, expires_at) VALUES (?, ?, ?, ?)', token, kind, subjectId, Date.now() + ttl);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: ttl,
    path: '/',
  });
  return token;
}

export function destroySession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

// 모든 요청에 req.auth 를 붙인다: { kind:'user', user } | { kind:'student', student, klass } | null
export function sessionMiddleware(req, _res, next) {
  req.auth = null;
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return next();
  const s = one('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return next();
  if (s.expires_at < Date.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return next();
  }
  if (s.kind === 'user') {
    const user = one('SELECT id, role, email, name, school_id, school_name, status FROM users WHERE id = ?', s.subject_id);
    if (user && user.status === 'active') req.auth = { kind: 'user', user };
  } else {
    const student = one('SELECT id, class_id, name, number, avatar FROM students WHERE id = ?', s.subject_id);
    if (student) {
      const klass = one(
        `SELECT c.id, c.name, c.grade, c.code, c.teacher_id, c.ai_enabled, c.gallery_enabled, c.checkin_enabled, c.archived, u.school_id
           FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?`,
        student.class_id,
      );
      if (klass && !klass.archived) req.auth = { kind: 'student', student, klass };
    }
  }
  next();
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requireUser(req) {
  if (req.auth?.kind !== 'user') throw new HttpError(401, '로그인이 필요합니다.');
  return req.auth.user;
}

export function requireTeacher(req) {
  const user = requireUser(req);
  if (user.role !== 'teacher' && user.role !== 'admin') throw new HttpError(403, '교사 권한이 필요합니다.');
  return user;
}

export function requireAdmin(req) {
  const user = requireUser(req);
  if (user.role !== 'admin') throw new HttpError(403, '관리자 권한이 필요합니다.');
  return user;
}

export function requireStudent(req) {
  if (req.auth?.kind !== 'student') throw new HttpError(401, '학생 로그인이 필요합니다.');
  return req.auth;
}

// 교사가 소유한 학급인지 확인 (관리자는 모든 학급 접근)
export function requireOwnedClass(req, classId) {
  const user = requireTeacher(req);
  const klass = one('SELECT * FROM classes WHERE id = ?', Number(classId));
  if (!klass) throw new HttpError(404, '학급을 찾을 수 없습니다.');
  if (user.role !== 'admin' && klass.teacher_id !== user.id) throw new HttpError(403, '내 학급이 아닙니다.');
  return { user, klass };
}

// 간단한 시도 횟수 제한 (메모리)
const attempts = new Map();
export function checkRateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) {
    const wait = Math.ceil((entry.reset - now) / 60000);
    throw new HttpError(429, `시도가 너무 많아요. ${wait}분 뒤에 다시 해 주세요.`);
  }
}
export function clearRateLimit(key) {
  attempts.delete(key);
}

export function purgeExpiredSessions() {
  run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
}
