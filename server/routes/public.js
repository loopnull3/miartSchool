// 공개 API — 랜딩 페이지 통계 · 후기 · 수업 자료 미리보기 · 문의
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, checkRateLimit, requireAdmin } from '../auth.js';
import { getLessons } from './lessons.js';
import { localDay } from '../time.js';

const r = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.get('/public/site', (_req, res) => {
  const today = localDay();
  res.json({
    stats: {
      schools: one('SELECT COUNT(*) n FROM schools WHERE active = 1').n,
      teachers: one("SELECT COUNT(*) n FROM users WHERE role = 'teacher' AND status = 'active'").n,
      artworks: one("SELECT COUNT(*) n FROM artworks WHERE status = 'submitted'").n,
      today: one("SELECT COUNT(*) n FROM artworks WHERE status = 'submitted' AND substr(submitted_at, 1, 10) >= ?", today).n,
    },
    testimonials: all('SELECT id, quote, name, role FROM testimonials ORDER BY sort, id'),
  });
});

r.get('/public/lessons', async (_req, res) => {
  const lessons = await getLessons();
  res.json(
    lessons.map((l) => ({ id: l.id, title: l.title, summary: l.summary, technique: l.technique, template: l.template, grade: l.grade, season: l.season, subjects: l.subjects, cover: l.cover, pinned: l.pinned })),
  );
});

r.post('/public/inquiries', (req, res) => {
  checkRateLimit(`inq:${req.ip}`, 8, 3600_000);
  const b = req.body || {};
  const type = ['purchase', 'idea', 'trial'].includes(b.type) ? b.type : 'idea';
  const name = String(b.name || '').trim().slice(0, 40);
  const email = String(b.email || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, '이름을 입력해 주세요.');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, '연락받을 이메일을 확인해 주세요.');
  const message = String(b.message || '').trim().slice(0, 2000);
  if (type === 'idea' && !message) throw new HttpError(400, '아이디어를 적어 주세요.');
  run(
    'INSERT INTO inquiries (type, name, email, phone, school, teachers, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
    type,
    name,
    email,
    String(b.phone || '').trim().slice(0, 30) || null,
    String(b.school || '').trim().slice(0, 80) || null,
    Number.isFinite(Number(b.teachers)) && Number(b.teachers) > 0 ? Math.min(10000, Math.round(Number(b.teachers))) : null,
    message || null,
  );
  res.json({ ok: true });
});

// 관리자: 문의 · 후기 관리
r.get('/admin/inquiries', (req, res) => {
  requireAdmin(req);
  res.json(all("SELECT * FROM inquiries ORDER BY status = 'done', created_at DESC LIMIT 500"));
});

r.patch('/admin/inquiries/:id', (req, res) => {
  requireAdmin(req);
  run('UPDATE inquiries SET status = ? WHERE id = ?', req.body?.status === 'done' ? 'done' : 'new', Number(req.params.id));
  res.json({ ok: true });
});

r.get('/admin/testimonials', (req, res) => {
  requireAdmin(req);
  res.json(all('SELECT * FROM testimonials ORDER BY sort, id'));
});

r.post('/admin/testimonials', (req, res) => {
  requireAdmin(req);
  const quote = String(req.body?.quote || '').trim().slice(0, 300);
  const name = String(req.body?.name || '').trim().slice(0, 40);
  if (!quote || !name) throw new HttpError(400, '후기 내용과 이름을 입력해 주세요.');
  const info = run(
    'INSERT INTO testimonials (quote, name, role, sort) VALUES (?, ?, ?, ?)',
    quote,
    name,
    String(req.body?.role || '').trim().slice(0, 60) || null,
    Number(req.body?.sort) || 0,
  );
  res.json(one('SELECT * FROM testimonials WHERE id = ?', Number(info.lastInsertRowid)));
});

r.delete('/admin/testimonials/:id', (req, res) => {
  requireAdmin(req);
  run('DELETE FROM testimonials WHERE id = ?', Number(req.params.id));
  res.json({ ok: true });
});

export default r;
