// 마음 날씨 체크인 — 학생: 오늘의 마음 기록, 교사: 월별 달력·추이
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, requireStudent, requireOwnedClass } from '../auth.js';
import { WEATHERS, EMOTIONS, CAUSES, MAX_EMOTIONS } from '../../shared/checkin.js';
import { localDay } from '../time.js';

const r = Router();

function parse(row) {
  return {
    id: row.id,
    student_id: row.student_id,
    day: row.day,
    weather: row.weather,
    emotions: JSON.parse(row.emotions_json || '[]'),
    causes: JSON.parse(row.causes_json || '[]'),
    note: row.note,
    updated_at: row.updated_at,
  };
}

r.get('/student/checkin', (req, res) => {
  const { student, klass } = requireStudent(req);
  const today = localDay();
  const row = one('SELECT * FROM checkins WHERE student_id = ? AND day = ?', student.id, today);
  const recent = all('SELECT * FROM checkins WHERE student_id = ? ORDER BY day DESC LIMIT 14', student.id).map(parse);
  res.json({ enabled: !!klass.checkin_enabled, today, entry: row ? parse(row) : null, recent });
});

r.post('/student/checkin', (req, res) => {
  const { student, klass } = requireStudent(req);
  if (!klass.checkin_enabled) throw new HttpError(403, '선생님이 마음 날씨 체크인을 꺼 두었어요.');
  const b = req.body || {};
  if (!WEATHERS.some((w) => w.key === b.weather)) throw new HttpError(400, '오늘의 마음 날씨를 골라 주세요.');
  const emotions = [...new Set((Array.isArray(b.emotions) ? b.emotions : []).filter((e) => EMOTIONS.some((x) => x.key === e)))].slice(0, MAX_EMOTIONS);
  const causes = [...new Set((Array.isArray(b.causes) ? b.causes : []).filter((c) => CAUSES.some((x) => x.key === c)))];
  const note = String(b.note || '').trim().slice(0, 200) || null;
  const day = localDay();
  run(
    `INSERT INTO checkins (student_id, class_id, day, weather, emotions_json, causes_json, note) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, day) DO UPDATE SET weather = excluded.weather, emotions_json = excluded.emotions_json,
       causes_json = excluded.causes_json, note = excluded.note, class_id = excluded.class_id, updated_at = datetime('now')`,
    student.id,
    klass.id,
    day,
    b.weather,
    JSON.stringify(emotions),
    JSON.stringify(causes),
    note,
  );
  res.json(parse(one('SELECT * FROM checkins WHERE student_id = ? AND day = ?', student.id, day)));
});

// 교사: 월별 체크인 (YYYY-MM)
r.get('/classes/:id/checkins', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const today = localDay();
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : today.slice(0, 7);
  const students = all('SELECT id, name, number, avatar FROM students WHERE class_id = ? ORDER BY number IS NULL, number, name', klass.id);
  const entries = all('SELECT * FROM checkins WHERE class_id = ? AND day LIKE ? ORDER BY day', klass.id, `${month}-%`).map(parse);
  // 최근 연속 '비/천둥' 학생 (관심 신호)
  const since = localDay(new Date(Date.now() - 6 * 86400_000));
  const recent = all('SELECT * FROM checkins WHERE class_id = ? AND day >= ? ORDER BY day', klass.id, since).map(parse);
  const streaks = {};
  for (const s of students) {
    const mine = recent.filter((e) => e.student_id === s.id).sort((a, b) => (a.day < b.day ? 1 : -1));
    let n = 0;
    for (const e of mine) {
      if (e.weather === 'rain' || e.weather === 'storm') n++;
      else break;
    }
    if (n >= 2) streaks[s.id] = n;
  }
  res.json({ klass: { id: klass.id, name: klass.name, checkin_enabled: !!klass.checkin_enabled }, month, today, students, entries, streaks });
});

export default r;
