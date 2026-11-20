// 도안: 사진 스케치 / AI 주제 도안으로 만든 나만의 도안 저장
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError } from '../auth.js';
import { saveDataUrlImage, removeImage, sendImage } from '../storage.js';
import { aiAvailable, consumeAiQuota, generateSketch } from '../ai/claude.js';
import { findBuiltinTemplates } from '../../shared/builtin-templates.js';

const r = Router();

function requireAny(req) {
  if (!req.auth) throw new HttpError(401, '로그인이 필요합니다.');
  return req.auth;
}

function owner(auth) {
  return auth.kind === 'user' ? { kind: 'user', id: auth.user.id, classId: null } : { kind: 'student', id: auth.student.id, classId: auth.klass.id };
}

// 볼 수 있는 도안: 내 도안 + (학생이면) 담임 선생님 도안
function canView(auth, t) {
  if (auth.kind === 'user') return auth.user.role === 'admin' || (t.owner_kind === 'user' && t.owner_id === auth.user.id) || isMyStudentsTemplate(auth.user.id, t);
  if (t.owner_kind === 'student') return t.owner_id === auth.student.id;
  return t.owner_id === auth.klass.teacher_id;
}

function isMyStudentsTemplate(teacherId, t) {
  if (t.owner_kind !== 'student' || !t.class_id) return false;
  const c = one('SELECT teacher_id FROM classes WHERE id = ?', t.class_id);
  return c?.teacher_id === teacherId;
}

r.get('/templates', (req, res) => {
  const auth = requireAny(req);
  let rows;
  if (auth.kind === 'user') {
    rows = all("SELECT * FROM templates WHERE owner_kind = 'user' AND owner_id = ? ORDER BY created_at DESC", auth.user.id);
  } else {
    rows = all(
      `SELECT * FROM templates
        WHERE (owner_kind = 'student' AND owner_id = ?) OR (owner_kind = 'user' AND owner_id = ?)
        ORDER BY owner_kind = 'student' DESC, created_at DESC`,
      auth.student.id,
      auth.klass.teacher_id,
    );
  }
  res.json(rows.map((t) => ({ id: t.id, ref: `t:${t.id}`, title: t.title, source: t.source, mine: auth.kind === 'user' ? true : t.owner_kind === 'student', created_at: t.created_at })));
});

r.post('/templates', (req, res) => {
  const auth = requireAny(req);
  const o = owner(auth);
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 30) || '내 도안';
  const source = ['photo', 'ai', 'upload'].includes(b.source) ? b.source : 'upload';
  const count = one('SELECT COUNT(*) n FROM templates WHERE owner_kind = ? AND owner_id = ?', o.kind, o.id).n;
  if (count >= 300) throw new HttpError(400, '도안은 300개까지 저장할 수 있어요. 안 쓰는 도안을 지워 주세요.');
  const image = saveDataUrlImage(b.image);
  const thumb = b.thumb ? saveDataUrlImage(b.thumb, { maxBytes: 2 * 1024 * 1024 }) : null;
  const info = run(
    'INSERT INTO templates (owner_kind, owner_id, class_id, title, source, image_file, thumb_file) VALUES (?, ?, ?, ?, ?, ?, ?)',
    o.kind,
    o.id,
    o.classId,
    title,
    source,
    image,
    thumb,
  );
  const id = Number(info.lastInsertRowid);
  res.json({ id, ref: `t:${id}`, title, source });
});

r.get('/templates/:id/image', (req, res) => {
  const auth = requireAny(req);
  const t = one('SELECT * FROM templates WHERE id = ?', Number(req.params.id));
  if (!t || !canView(auth, t)) throw new HttpError(404, '도안을 찾을 수 없습니다.');
  sendImage(res, req.query.thumb ? t.thumb_file || t.image_file : t.image_file);
});

r.delete('/templates/:id', (req, res) => {
  const auth = requireAny(req);
  const o = owner(auth);
  const t = one('SELECT * FROM templates WHERE id = ?', Number(req.params.id));
  if (!t || t.owner_kind !== o.kind || t.owner_id !== o.id) throw new HttpError(404, '도안을 찾을 수 없습니다.');
  run('DELETE FROM templates WHERE id = ?', t.id);
  removeImage(t.image_file);
  removeImage(t.thumb_file);
  res.json({ ok: true });
});

// AI
r.get('/ai/status', (req, res) => {
  const auth = req.auth;
  const classEnabled = auth?.kind === 'student' ? !!auth.klass.ai_enabled : true;
  res.json({ available: aiAvailable(), enabled: aiAvailable() && classEnabled });
});

r.post('/ai/sketch', async (req, res) => {
  const auth = requireAny(req);
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) throw new HttpError(400, '어떤 그림을 원하는지 적어 주세요.');
  const suggestions = findBuiltinTemplates(prompt).slice(0, 4).map((t) => t.id);
  if (auth.kind === 'student' && !auth.klass.ai_enabled) throw Object.assign(new HttpError(403, '선생님이 AI 도안 기능을 꺼 두었어요.'), { extra: { suggestions } });
  if (!aiAvailable()) throw Object.assign(new HttpError(503, 'AI 도안 기능이 아직 설정되지 않았어요. 비슷한 기본 도안을 골라 보세요.'), { extra: { suggestions } });
  consumeAiQuota(auth.kind === 'student' ? `class:${auth.klass.id}` : `teacher:${auth.user.id}`);
  const result = await generateSketch(prompt);
  res.json({ ...result, suggestions });
});

export default r;
