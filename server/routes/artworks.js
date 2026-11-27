// 작품: 학생 저장/제출, 교사 피드백·전시, 이미지 접근 제어
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, requireStudent, requireOwnedClass } from '../auth.js';
import { saveDataUrlImage, removeImage, sendImage, saveDraft, readDraft, removeDraft } from '../storage.js';

const r = Router();
export const STAMPS = ['참 잘했어요', '멋져요', '창의력 최고', '색감 최고', '꼼꼼해요', '노력상', '상상력 대장', '다음엔 더 멋질 거야'];

function parseStats(stats) {
  if (!stats || typeof stats !== 'object') return null;
  const json = JSON.stringify(stats);
  return json.length > 20000 ? null : json;
}

function feedbackFor(artworkId) {
  return all(
    `SELECT f.id, f.stamp, f.comment, f.created_at, u.name AS teacher_name
       FROM feedback f JOIN users u ON u.id = f.teacher_id WHERE f.artwork_id = ? ORDER BY f.created_at`,
    artworkId,
  );
}

function publicArtwork(a) {
  return {
    id: a.id,
    title: a.title,
    status: a.status,
    assignment_id: a.assignment_id,
    assignment_title: a.assignment_title ?? null,
    template_ref: a.template_ref,
    technique: a.technique || 'watercolor',
    width: a.width,
    height: a.height,
    exhibited: !!a.exhibited,
    seen_feedback: !!a.seen_feedback,
    has_draft: !!a.draft_file,
    created_at: a.created_at,
    updated_at: a.updated_at,
    submitted_at: a.submitted_at,
    student_id: a.student_id,
    student_name: a.student_name ?? null,
    student_avatar: a.student_avatar ?? null,
    feedback_count: a.feedback_count ?? undefined,
  };
}

// 접근 권한: 작품 주인 학생 / 학급 담당 교사 / 같은 반 학생(전시작) / 관리자
function canView(req, a) {
  const auth = req.auth;
  if (!auth) return false;
  if (auth.kind === 'student') {
    if (a.student_id === auth.student.id) return true;
    return a.class_id === auth.klass.id && a.exhibited && a.status === 'submitted' && auth.klass.gallery_enabled;
  }
  if (auth.user.role === 'admin') return true;
  const klass = one('SELECT teacher_id FROM classes WHERE id = ?', a.class_id);
  return klass?.teacher_id === auth.user.id;
}

function getArtwork(id) {
  const a = one('SELECT * FROM artworks WHERE id = ?', Number(id));
  if (!a) throw new HttpError(404, '작품을 찾을 수 없습니다.');
  return a;
}

function ownArtwork(req, id) {
  const { student } = requireStudent(req);
  const a = getArtwork(id);
  if (a.student_id !== student.id) throw new HttpError(403, '내 작품이 아니에요.');
  return a;
}

function validAssignment(klassId, assignmentId) {
  if (assignmentId == null || assignmentId === '') return null;
  const g = one('SELECT id, status FROM assignments WHERE id = ? AND class_id = ?', Number(assignmentId), klassId);
  if (!g) throw new HttpError(400, '과제를 찾을 수 없습니다.');
  return g.id;
}

// 학생: 새 작품 저장 (임시저장 또는 제출)
r.post('/artworks', (req, res) => {
  const { student, klass } = requireStudent(req);
  const b = req.body || {};
  const width = Math.round(Number(b.width));
  const height = Math.round(Number(b.height));
  if (!(width > 0 && width <= 4096 && height > 0 && height <= 4096)) throw new HttpError(400, '캔버스 크기가 올바르지 않습니다.');
  const assignmentId = validAssignment(klass.id, b.assignmentId);
  const submit = !!b.submit;
  const image = b.image ? saveDataUrlImage(b.image) : null;
  const thumb = b.thumb ? saveDataUrlImage(b.thumb, { maxBytes: 2 * 1024 * 1024 }) : null;
  const draft = b.draft ? saveDraft(null, b.draft) : null;
  if (submit && !image) throw new HttpError(400, '제출할 그림이 없습니다.');
  const info = run(
    `INSERT INTO artworks (student_id, class_id, assignment_id, title, template_ref, width, height, image_file, thumb_file, draft_file, stats_json, status, submitted_at, technique)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    student.id,
    klass.id,
    assignmentId,
    String(b.title || '').trim().slice(0, 40) || '내 그림',
    b.templateRef ? String(b.templateRef).slice(0, 40) : null,
    width,
    height,
    image,
    thumb,
    draft,
    parseStats(b.stats),
    submit ? 'submitted' : 'draft',
    submit ? new Date().toISOString() : null,
    b.technique === 'oil' ? 'oil' : 'watercolor',
  );
  res.json(publicArtwork(getArtwork(Number(info.lastInsertRowid))));
});

// 학생: 기존 작품 업데이트
r.put('/artworks/:id', (req, res) => {
  const a = ownArtwork(req, req.params.id);
  const { klass } = req.auth;
  const b = req.body || {};
  let image = a.image_file;
  let thumb = a.thumb_file;
  if (b.image) {
    image = saveDataUrlImage(b.image);
    if (a.image_file) removeImage(a.image_file);
  }
  if (b.thumb) {
    thumb = saveDataUrlImage(b.thumb, { maxBytes: 2 * 1024 * 1024 });
    if (a.thumb_file) removeImage(a.thumb_file);
  }
  const draft = b.draft ? saveDraft(a.draft_file, b.draft) : a.draft_file;
  const submit = b.submit === true || (a.status === 'submitted' && b.submit !== false);
  if (submit && !image) throw new HttpError(400, '제출할 그림이 없습니다.');
  run(
    `UPDATE artworks SET title = ?, assignment_id = ?, image_file = ?, thumb_file = ?, draft_file = ?, stats_json = COALESCE(?, stats_json),
            status = ?, submitted_at = CASE WHEN ? AND submitted_at IS NULL THEN ? ELSE submitted_at END, updated_at = datetime('now')
      WHERE id = ?`,
    b.title != null ? String(b.title).trim().slice(0, 40) || a.title : a.title,
    b.assignmentId !== undefined ? validAssignment(klass.id, b.assignmentId) : a.assignment_id,
    image,
    thumb,
    draft,
    parseStats(b.stats),
    submit ? 'submitted' : 'draft',
    submit ? 1 : 0,
    new Date().toISOString(),
    a.id,
  );
  res.json(publicArtwork(getArtwork(a.id)));
});

r.get('/artworks/:id', (req, res) => {
  const a = getArtwork(req.params.id);
  if (!canView(req, a)) throw new HttpError(403, '볼 수 없는 작품입니다.');
  const s = one('SELECT name, avatar FROM students WHERE id = ?', a.student_id);
  const g = a.assignment_id ? one('SELECT title FROM assignments WHERE id = ?', a.assignment_id) : null;
  const isOwnerOrTeacher = req.auth.kind === 'user' || a.student_id === req.auth.student.id;
  res.json({
    ...publicArtwork({ ...a, student_name: s?.name, student_avatar: s?.avatar, assignment_title: g?.title }),
    feedback: isOwnerOrTeacher ? feedbackFor(a.id) : [],
    stats: req.auth.kind === 'user' && a.stats_json ? JSON.parse(a.stats_json) : undefined,
  });
});

r.get('/artworks/:id/image', (req, res) => {
  const a = getArtwork(req.params.id);
  if (!canView(req, a)) throw new HttpError(403, '볼 수 없는 작품입니다.');
  sendImage(res, req.query.thumb ? a.thumb_file || a.image_file : a.image_file || a.thumb_file);
});

r.get('/artworks/:id/draft', (req, res) => {
  const a = ownArtwork(req, req.params.id);
  const draft = readDraft(a.draft_file);
  res.json({ artwork: publicArtwork(a), draft });
});

r.delete('/artworks/:id', (req, res) => {
  const a = getArtwork(req.params.id);
  if (req.auth?.kind === 'student') {
    if (a.student_id !== req.auth.student.id) throw new HttpError(403, '내 작품이 아니에요.');
    if (a.status === 'submitted') throw new HttpError(400, '제출한 작품은 선생님만 지울 수 있어요.');
  } else {
    requireOwnedClass(req, a.class_id);
  }
  run('DELETE FROM artworks WHERE id = ?', a.id);
  removeImage(a.image_file);
  removeImage(a.thumb_file);
  removeDraft(a.draft_file);
  res.json({ ok: true });
});

// 교사: 피드백(도장 + 한마디)
r.post('/artworks/:id/feedback', (req, res) => {
  const a = getArtwork(req.params.id);
  const { user } = requireOwnedClass(req, a.class_id);
  const stamp = req.body?.stamp ? String(req.body.stamp) : null;
  if (stamp && !STAMPS.includes(stamp)) throw new HttpError(400, '도장 종류가 올바르지 않습니다.');
  const comment = String(req.body?.comment || '').trim().slice(0, 300) || null;
  if (!stamp && !comment) throw new HttpError(400, '도장이나 한마디를 남겨 주세요.');
  run('INSERT INTO feedback (artwork_id, teacher_id, stamp, comment) VALUES (?, ?, ?, ?)', a.id, user.id, stamp, comment);
  run('UPDATE artworks SET seen_feedback = 0 WHERE id = ?', a.id);
  res.json(feedbackFor(a.id));
});

r.delete('/feedback/:id', (req, res) => {
  const f = one('SELECT f.*, a.class_id FROM feedback f JOIN artworks a ON a.id = f.artwork_id WHERE f.id = ?', Number(req.params.id));
  if (!f) throw new HttpError(404, '피드백을 찾을 수 없습니다.');
  requireOwnedClass(req, f.class_id);
  run('DELETE FROM feedback WHERE id = ?', f.id);
  res.json({ ok: true });
});

r.post('/artworks/:id/exhibit', (req, res) => {
  const a = getArtwork(req.params.id);
  requireOwnedClass(req, a.class_id);
  run('UPDATE artworks SET exhibited = ? WHERE id = ?', req.body?.exhibited ? 1 : 0, a.id);
  res.json({ ok: true, exhibited: !!req.body?.exhibited });
});

r.get('/stamps', (_req, res) => res.json(STAMPS));

// 교사: 학급 갤러리 (제출작)
r.get('/classes/:id/artworks', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const where = ["a.class_id = ?", "a.status = 'submitted'"];
  const params = [klass.id];
  if (req.query.assignment === 'free') where.push('a.assignment_id IS NULL');
  else if (req.query.assignment) {
    where.push('a.assignment_id = ?');
    params.push(Number(req.query.assignment));
  }
  if (req.query.student) {
    where.push('a.student_id = ?');
    params.push(Number(req.query.student));
  }
  if (req.query.unreviewed) where.push('NOT EXISTS (SELECT 1 FROM feedback f WHERE f.artwork_id = a.id)');
  const rows = all(
    `SELECT a.*, s.name AS student_name, s.avatar AS student_avatar, g.title AS assignment_title,
            (SELECT COUNT(*) FROM feedback f WHERE f.artwork_id = a.id) AS feedback_count
       FROM artworks a JOIN students s ON s.id = a.student_id LEFT JOIN assignments g ON g.id = a.assignment_id
      WHERE ${where.join(' AND ')} ORDER BY a.submitted_at DESC LIMIT 300`,
    ...params,
  );
  res.json(rows.map(publicArtwork));
});

// 학생: 홈 화면 데이터
export function assignmentView(g) {
  const now = new Date().toISOString();
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    template_ref: g.template_ref,
    orientation: g.orientation,
    technique: g.technique || 'watercolor',
    paper: g.paper,
    steps: g.steps_json ? JSON.parse(g.steps_json) : [],
    materials: g.materials_json ? JSON.parse(g.materials_json) : [],
    start_at: g.start_at,
    end_at: g.end_at,
    due_date: g.due_date,
    created_at: g.created_at,
    closed: g.status === 'closed' || (g.end_at != null && g.end_at < now),
    submitted_id: g.submitted_id ?? null,
    draft_id: g.draft_id ?? null,
  };
}

r.get('/student/assignments', (req, res) => {
  const { student, klass } = requireStudent(req);
  const now = new Date().toISOString();
  const rows = all(
    `SELECT g.*,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'submitted' ORDER BY a.submitted_at DESC LIMIT 1) AS submitted_id,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'draft' ORDER BY a.updated_at DESC LIMIT 1) AS draft_id
       FROM assignments g WHERE g.class_id = ? AND (g.start_at IS NULL OR g.start_at <= ?)
      ORDER BY g.created_at DESC`,
    student.id,
    student.id,
    klass.id,
    now,
  );
  res.json(rows.map(assignmentView));
});

r.get('/student/assignments/:id', (req, res) => {
  const { student, klass } = requireStudent(req);
  const g = one(
    `SELECT g.*,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'submitted' ORDER BY a.submitted_at DESC LIMIT 1) AS submitted_id,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'draft' ORDER BY a.updated_at DESC LIMIT 1) AS draft_id
       FROM assignments g WHERE g.id = ? AND g.class_id = ?`,
    student.id,
    student.id,
    Number(req.params.id),
    klass.id,
  );
  if (!g || (g.start_at && g.start_at > new Date().toISOString())) throw new HttpError(404, '과제를 찾을 수 없어요.');
  res.json(assignmentView(g));
});

r.get('/student/home', (req, res) => {
  const { student, klass } = requireStudent(req);
  const now = new Date().toISOString();
  const assignments = all(
    `SELECT g.*,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'submitted' LIMIT 1) AS submitted_id,
            (SELECT a.id FROM artworks a WHERE a.assignment_id = g.id AND a.student_id = ? AND a.status = 'draft' ORDER BY a.updated_at DESC LIMIT 1) AS draft_id
       FROM assignments g WHERE g.class_id = ? AND g.status = 'open' AND (g.start_at IS NULL OR g.start_at <= ?)
         AND (g.end_at IS NULL OR g.end_at >= ?)
      ORDER BY g.created_at DESC`,
    student.id,
    student.id,
    klass.id,
    now,
    now,
  ).map(assignmentView);
  const psych = all(
    `SELECT p.id, p.title, p.created_at,
            EXISTS (SELECT 1 FROM psych_results r WHERE r.campaign_id = p.id AND r.student_id = ?) AS done
       FROM psych_campaigns p WHERE p.class_id = ? AND p.status = 'open' ORDER BY p.created_at DESC`,
    student.id,
    klass.id,
  );
  const newFeedback = one('SELECT COUNT(*) n FROM artworks WHERE student_id = ? AND seen_feedback = 0', student.id).n;
  const recent = all("SELECT * FROM artworks WHERE student_id = ? ORDER BY updated_at DESC LIMIT 6", student.id).map(publicArtwork);
  res.json({
    student,
    klass: { name: klass.name, grade: klass.grade, ai_enabled: !!klass.ai_enabled, gallery_enabled: !!klass.gallery_enabled, checkin_enabled: !!klass.checkin_enabled },
    assignments,
    psych,
    newFeedback,
    recent,
  });
});

r.get('/student/artworks', (req, res) => {
  const { student } = requireStudent(req);
  const rows = all(
    `SELECT a.*, g.title AS assignment_title, (SELECT COUNT(*) FROM feedback f WHERE f.artwork_id = a.id) AS feedback_count
       FROM artworks a LEFT JOIN assignments g ON g.id = a.assignment_id
      WHERE a.student_id = ? ORDER BY a.updated_at DESC`,
    student.id,
  );
  res.json(rows.map(publicArtwork));
});

r.post('/student/artworks/:id/seen', (req, res) => {
  const a = ownArtwork(req, req.params.id);
  run('UPDATE artworks SET seen_feedback = 1 WHERE id = ?', a.id);
  res.json({ ok: true });
});

// 학생: 우리 반 전시회
r.get('/student/gallery', (req, res) => {
  const { klass } = requireStudent(req);
  if (!klass.gallery_enabled) return res.json([]);
  const rows = all(
    `SELECT a.*, s.name AS student_name, s.avatar AS student_avatar, g.title AS assignment_title
       FROM artworks a JOIN students s ON s.id = a.student_id LEFT JOIN assignments g ON g.id = a.assignment_id
      WHERE a.class_id = ? AND a.exhibited = 1 AND a.status = 'submitted' ORDER BY a.submitted_at DESC LIMIT 200`,
    klass.id,
  );
  res.json(rows.map(publicArtwork));
});

export default r;
