import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, requireAdmin, randomCode } from '../auth.js';
import { aiAvailable } from '../ai/claude.js';

const r = Router();

r.get('/admin/overview', (req, res) => {
  requireAdmin(req);
  res.json({
    teachers: one("SELECT COUNT(*) n FROM users WHERE role = 'teacher' AND status = 'active'").n,
    pending: one("SELECT COUNT(*) n FROM users WHERE status = 'pending'").n,
    schools: one('SELECT COUNT(*) n FROM schools WHERE active = 1').n,
    classes: one('SELECT COUNT(*) n FROM classes WHERE archived = 0').n,
    students: one('SELECT COUNT(*) n FROM students').n,
    artworks: one("SELECT COUNT(*) n FROM artworks WHERE status = 'submitted'").n,
    psych: one('SELECT COUNT(*) n FROM psych_results').n,
    aiAvailable: aiAvailable(),
  });
});

r.get('/admin/teachers', (req, res) => {
  requireAdmin(req);
  res.json(
    all(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.school_name, u.created_at,
              (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = u.id AND c.archived = 0) AS class_count
         FROM users u ORDER BY (u.status = 'pending') DESC, u.created_at DESC`,
    ),
  );
});

r.post('/admin/teachers/:id/status', (req, res) => {
  const admin = requireAdmin(req);
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!['active', 'disabled', 'pending'].includes(status)) throw new HttpError(400, '상태 값이 올바르지 않습니다.');
  if (id === admin.id) throw new HttpError(400, '내 계정 상태는 바꿀 수 없습니다.');
  const info = run('UPDATE users SET status = ? WHERE id = ?', status, id);
  if (!info.changes) throw new HttpError(404, '사용자를 찾을 수 없습니다.');
  if (status !== 'active') run("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?", id);
  res.json({ ok: true });
});

r.get('/admin/schools', (req, res) => {
  requireAdmin(req);
  res.json(
    all(
      `SELECT s.*, (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id) AS teacher_count
         FROM schools s ORDER BY s.created_at DESC`,
    ),
  );
});

r.post('/admin/schools', (req, res) => {
  requireAdmin(req);
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, '학교(기관) 이름을 입력해 주세요.');
  let code;
  do code = randomCode(8);
  while (one('SELECT id FROM schools WHERE invite_code = ?', code));
  const info = run('INSERT INTO schools (name, invite_code) VALUES (?, ?)', name, code);
  res.json({ id: Number(info.lastInsertRowid), name, invite_code: code });
});

r.patch('/admin/schools/:id', (req, res) => {
  requireAdmin(req);
  const id = Number(req.params.id);
  const school = one('SELECT * FROM schools WHERE id = ?', id);
  if (!school) throw new HttpError(404, '학교를 찾을 수 없습니다.');
  if (typeof req.body?.active === 'boolean') run('UPDATE schools SET active = ? WHERE id = ?', req.body.active ? 1 : 0, id);
  if (req.body?.regenerate) {
    let code;
    do code = randomCode(8);
    while (one('SELECT id FROM schools WHERE invite_code = ?', code));
    run('UPDATE schools SET invite_code = ? WHERE id = ?', code, id);
  }
  res.json(one('SELECT * FROM schools WHERE id = ?', id));
});

export default r;
