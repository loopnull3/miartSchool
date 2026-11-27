// 미아트스쿨 서버
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, closeDb, one, run } from './db.js';
import { sessionMiddleware, HttpError, hashPassword, purgeExpiredSessions } from './auth.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import classRoutes from './routes/classes.js';
import artworkRoutes from './routes/artworks.js';
import templateRoutes from './routes/templates.js';
import psychRoutes from './routes/psych.js';
import checkinRoutes from './routes/checkins.js';
import boardRoutes from './routes/boards.js';
import lessonRoutes from './routes/lessons.js';
import publicRoutes from './routes/public.js';
import { backfillStudentLogins } from './routes/classes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// 간단한 .env 로더 (의존성 없이)
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const WEAK_PASSWORDS = new Set(['change-me-please', 'admin1234', 'password', '12345678', 'miart1234']);

export function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (one("SELECT id FROM users WHERE role = 'admin'")) return;
  // 운영 서버에서는 예시·짧은 비밀번호로 관리자를 만들지 않는다
  if (process.env.NODE_ENV === 'production' && (WEAK_PASSWORDS.has(password) || password.length < 10)) {
    console.error('[miart] ADMIN_PASSWORD가 예시 값이거나 너무 짧아요(10자 이상). .env에서 바꾼 뒤 다시 시작하면 관리자 계정이 만들어져요.');
    return;
  }
  if (one('SELECT id FROM users WHERE email = ?', email)) {
    run("UPDATE users SET role = 'admin', status = 'active' WHERE email = ?", email);
  } else {
    run("INSERT INTO users (role, email, name, password_hash, status) VALUES ('admin', ?, '관리자', ?, 'active')", email, hashPassword(password));
  }
  console.log(`[miart] 관리자 계정 준비됨: ${email}`);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // 리버스 프록시(Caddy·Nginx) 뒤에서 실제 접속 IP를 쓰기 위한 설정. Docker 구성은 'loopback, uniquelocal'
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use('/api', express.json({ limit: '40mb' }));
  app.use('/api', sessionMiddleware);

  // CSRF 방지: 상태를 바꾸는 API 요청은 앱이 붙이는 헤더가 있어야 한다
  app.use('/api', (req, _res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-miart') !== '1') {
      return next(new HttpError(403, '잘못된 요청입니다.'));
    }
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', authRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', classRoutes);
  app.use('/api', artworkRoutes);
  app.use('/api', templateRoutes);
  app.use('/api', psychRoutes);
  app.use('/api', checkinRoutes);
  app.use('/api', boardRoutes);
  app.use('/api', lessonRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, '없는 API입니다.')));

  // 정적 파일 (프런트엔드 + 공용 모듈)
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: '1h' }));
  app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h', index: 'index.html' }));
  // SPA: 확장자 없는 경로만 index.html (없는 정적 파일은 404)
  app.get('/{*splat}', (req, res, next) => (path.extname(req.path) ? next() : res.sendFile(path.join(ROOT, 'public', 'index.html'))));
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

  // 오류 처리
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.too.large') err = new HttpError(413, '파일이 너무 큽니다.');
    if (err.type === 'entity.parse.failed') err = new HttpError(400, '요청 형식이 올바르지 않습니다.');
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500 && !(err instanceof HttpError)) console.error('[miart] error', req.method, req.path, err);
    res.status(status).json({ error: status === 500 && !(err instanceof HttpError) ? '서버 오류가 발생했어요.' : err.message, ...(err.extra || {}) });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  openDb();
  ensureAdmin();
  backfillStudentLogins();
  purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 3600_000).unref();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createApp().listen(port, host, () => {
    console.log(`[miart] 미아트스쿨 서버 실행 중: http://localhost:${port}`);
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) console.log('[miart] AI 키 없음 — AI 도안/AI 요약을 제외한 모든 기능이 동작합니다.');
    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'true') console.warn('[miart] 운영 모드인데 COOKIE_SECURE=true가 아니에요. HTTPS 뒤에서 운영하고 true로 설정하세요.');
  });
  // 컨테이너·서비스 종료 시 DB를 깨끗하게 닫는다
  let stopping = false;
  const shutdown = (sig) => {
    if (stopping) return;
    stopping = true;
    console.log(`[miart] ${sig} — 서버를 종료합니다.`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
