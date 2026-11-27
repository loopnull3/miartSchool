// 수업 자료 라이브러리 → 내 수업으로 저장 → 학급에서 시작하기(과제 만들기)
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, requireTeacher, requireOwnedClass } from '../auth.js';
import { createAssignment, cleanMaterials } from './classes.js';

const r = Router();

let lessonsCache = null;
export async function getLessons() {
  if (!lessonsCache) {
    try {
      lessonsCache = (await import('../../shared/lessons.js')).LESSONS || [];
    } catch {
      lessonsCache = [];
    }
  }
  return lessonsCache;
}

const EDITABLE = ['title', 'summary', 'description', 'technique', 'orientation', 'paper', 'template', 'steps', 'materials', 'minutes'];

function cleanLessonData(src) {
  const d = {};
  d.title = String(src.title || '').trim().slice(0, 60);
  if (!d.title) throw new HttpError(400, '수업 제목을 입력해 주세요.');
  d.summary = String(src.summary || '').trim().slice(0, 120);
  d.description = String(src.description || '').trim().slice(0, 1000);
  d.technique = src.technique === 'oil' ? 'oil' : 'watercolor';
  d.orientation = src.orientation === 'portrait' ? 'portrait' : 'landscape';
  d.paper = ['white', 'ivory', 'kraft', 'black', 'watercolor', 'canvas'].includes(src.paper) ? src.paper : null;
  d.template = src.template && /^(builtin:[a-z0-9-]+|t:\d+)$/.test(src.template) ? src.template : null;
  d.steps = (Array.isArray(src.steps) ? src.steps : []).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 12);
  d.materials = JSON.parse(cleanMaterials(src.materials) || '[]');
  d.minutes = Math.min(240, Math.max(10, Number(src.minutes) || 40));
  for (const k of ['grade', 'season', 'cover', 'subjects', 'goals', 'teacherTips', 'emoji']) if (src[k] != null) d[k] = src[k];
  return d;
}

function myLesson(req, id) {
  const user = requireTeacher(req);
  const row = one('SELECT * FROM teacher_lessons WHERE id = ?', Number(id));
  if (!row || (row.teacher_id !== user.id && user.role !== 'admin')) throw new HttpError(404, '수업을 찾을 수 없어요.');
  return { ...row, data: JSON.parse(row.data_json) };
}

r.get('/lessons', async (req, res) => {
  const user = requireTeacher(req);
  const saved = new Set(all('SELECT lesson_id FROM teacher_lessons WHERE teacher_id = ? AND lesson_id IS NOT NULL', user.id).map((x) => x.lesson_id));
  res.json((await getLessons()).map((l) => ({ ...l, saved: saved.has(l.id) })));
});

r.get('/my-lessons', (req, res) => {
  const user = requireTeacher(req);
  res.json(
    all('SELECT * FROM teacher_lessons WHERE teacher_id = ? ORDER BY updated_at DESC', user.id).map((x) => ({
      id: x.id,
      lesson_id: x.lesson_id,
      ...JSON.parse(x.data_json),
      created_at: x.created_at,
      updated_at: x.updated_at,
      assignments: one('SELECT COUNT(*) n FROM assignments g JOIN classes c ON c.id = g.class_id WHERE c.teacher_id = ? AND g.lesson_id = ?', user.id, `my:${x.id}`).n,
    })),
  );
});

r.post('/my-lessons', async (req, res) => {
  const user = requireTeacher(req);
  let src = req.body?.data;
  let lessonId = null;
  if (req.body?.lessonId) {
    src = (await getLessons()).find((l) => l.id === req.body.lessonId);
    if (!src) throw new HttpError(404, '수업 자료를 찾을 수 없어요.');
    lessonId = src.id;
    const dup = one('SELECT id FROM teacher_lessons WHERE teacher_id = ? AND lesson_id = ?', user.id, lessonId);
    if (dup) return res.json({ id: dup.id, existed: true });
  }
  if (!src) throw new HttpError(400, '저장할 수업이 없어요.');
  const data = cleanLessonData(src);
  const info = run('INSERT INTO teacher_lessons (teacher_id, lesson_id, data_json) VALUES (?, ?, ?)', user.id, lessonId, JSON.stringify(data));
  res.json({ id: Number(info.lastInsertRowid), existed: false });
});

r.get('/my-lessons/:id', (req, res) => {
  const l = myLesson(req, req.params.id);
  res.json({ id: l.id, lesson_id: l.lesson_id, ...l.data });
});

r.patch('/my-lessons/:id', (req, res) => {
  const l = myLesson(req, req.params.id);
  const merged = { ...l.data };
  for (const k of EDITABLE) if (req.body?.[k] !== undefined) merged[k] = req.body[k];
  const data = cleanLessonData(merged);
  run("UPDATE teacher_lessons SET data_json = ?, updated_at = datetime('now') WHERE id = ?", JSON.stringify(data), l.id);
  res.json({ id: l.id, lesson_id: l.lesson_id, ...data });
});

r.delete('/my-lessons/:id', (req, res) => {
  const l = myLesson(req, req.params.id);
  run('DELETE FROM teacher_lessons WHERE id = ?', l.id);
  res.json({ ok: true });
});

// 시작하기: 내 수업 → 학급 과제
r.post('/my-lessons/:id/start', (req, res) => {
  const l = myLesson(req, req.params.id);
  const { klass } = requireOwnedClass(req, req.body?.classId);
  const d = l.data;
  const g = createAssignment(klass.id, {
    title: req.body?.title || d.title,
    description: [d.summary, d.description].filter(Boolean).join('\n\n'),
    templateRef: d.template,
    orientation: d.orientation,
    technique: d.technique,
    paper: d.paper,
    steps: d.steps,
    materials: d.materials,
    startAt: req.body?.startAt,
    endAt: req.body?.endAt,
    lessonId: `my:${l.id}`,
  });
  res.json(g);
});

export default r;
