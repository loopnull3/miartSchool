// 그림 마음 탐색 (HTP) — 교사: 검사 열기/결과/학급 리포트/AI 요약, 학생: 검사 응시
import { Router } from 'express';
import fs from 'node:fs';
import { one, all, run } from '../db.js';
import { HttpError, requireStudent, requireOwnedClass } from '../auth.js';
import { saveDataUrlImage, removeImage, sendImage, imagePath } from '../storage.js';
import { analyzePsych, aggregateClass } from '../psych/analyze.js';
import { PSYCH_STEPS, DRAWING_STEPS } from '../../shared/psych-questions.js';
import { aiAvailable, consumeAiQuota, summarizePsych } from '../ai/claude.js';

const r = Router();

function campaignOwned(req, id) {
  const c = one('SELECT * FROM psych_campaigns WHERE id = ?', Number(id));
  if (!c) throw new HttpError(404, '검사를 찾을 수 없습니다.');
  const { klass, user } = requireOwnedClass(req, c.class_id);
  return { campaign: c, klass, user };
}

function resultOwned(req, id) {
  const row = one('SELECT * FROM psych_results WHERE id = ?', Number(id));
  if (!row) throw new HttpError(404, '결과를 찾을 수 없습니다.');
  const { campaign, klass } = campaignOwned(req, row.campaign_id);
  return { row, campaign, klass };
}

function parseResult(row) {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    student_id: row.student_id,
    answers: JSON.parse(row.answers_json),
    drawings: JSON.parse(row.drawings_json),
    report: JSON.parse(row.report_json),
    ai: row.ai_json ? JSON.parse(row.ai_json) : null,
    teacher_note: row.teacher_note,
    completed_at: row.completed_at,
  };
}

function cleanAnswers(raw) {
  const answers = {};
  for (const step of PSYCH_STEPS) {
    for (const q of step.questions) {
      const v = raw?.[q.id];
      if (v == null || v === '') continue;
      if (q.type === 'text') answers[q.id] = String(v).trim().slice(0, 120);
      else if (q.type === 'multi') {
        const arr = (Array.isArray(v) ? v : [v]).map(String).filter((x) => q.options.some((o) => o.value === x));
        if (arr.length) answers[q.id] = [...new Set(arr)];
      } else if (q.options.some((o) => o.value === String(v))) answers[q.id] = String(v);
    }
  }
  return answers;
}

export function answerLines(answers) {
  const lines = [];
  for (const step of PSYCH_STEPS) {
    for (const q of step.questions) {
      const v = answers[q.id];
      if (v == null) continue;
      let text;
      if (q.type === 'text') text = v;
      else {
        const vals = Array.isArray(v) ? v : [v];
        text = vals.map((x) => q.options.find((o) => o.value === x)?.label || x).join(', ');
      }
      lines.push(`[${step.title}] ${q.text} → ${text}`);
    }
  }
  return lines;
}

// ---- 교사 ----
r.get('/classes/:id/psych', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const studentCount = one('SELECT COUNT(*) n FROM students WHERE class_id = ?', klass.id).n;
  const rows = all(
    `SELECT p.*, (SELECT COUNT(*) FROM psych_results r WHERE r.campaign_id = p.id) AS completed
       FROM psych_campaigns p WHERE p.class_id = ? ORDER BY p.created_at DESC`,
    klass.id,
  );
  res.json({ campaigns: rows, studentCount });
});

r.post('/classes/:id/psych', (req, res) => {
  const { klass } = requireOwnedClass(req, req.params.id);
  const title = String(req.body?.title || '').trim().slice(0, 40) || `${new Date().getMonth() + 1}월 그림 마음 탐색`;
  const info = run('INSERT INTO psych_campaigns (class_id, title) VALUES (?, ?)', klass.id, title);
  res.json(one('SELECT * FROM psych_campaigns WHERE id = ?', Number(info.lastInsertRowid)));
});

r.patch('/psych/campaigns/:id', (req, res) => {
  const { campaign } = campaignOwned(req, req.params.id);
  const status = req.body?.status === 'closed' ? 'closed' : req.body?.status === 'open' ? 'open' : campaign.status;
  const title = req.body?.title ? String(req.body.title).trim().slice(0, 40) : campaign.title;
  run('UPDATE psych_campaigns SET status = ?, title = ? WHERE id = ?', status, title, campaign.id);
  res.json(one('SELECT * FROM psych_campaigns WHERE id = ?', campaign.id));
});

r.delete('/psych/campaigns/:id', (req, res) => {
  const { campaign } = campaignOwned(req, req.params.id);
  const results = all('SELECT drawings_json FROM psych_results WHERE campaign_id = ?', campaign.id);
  run('DELETE FROM psych_campaigns WHERE id = ?', campaign.id);
  for (const r0 of results) for (const d of Object.values(JSON.parse(r0.drawings_json))) {
    removeImage(d.image);
    removeImage(d.thumb);
  }
  res.json({ ok: true });
});

// 학급 리포트
r.get('/psych/campaigns/:id/report', (req, res) => {
  const { campaign, klass } = campaignOwned(req, req.params.id);
  const students = all('SELECT id, name, number, avatar FROM students WHERE class_id = ? ORDER BY number IS NULL, number, name', klass.id);
  const rows = all('SELECT * FROM psych_results WHERE campaign_id = ?', campaign.id).map(parseResult);
  const byStudent = new Map(rows.map((x) => [x.student_id, x]));
  const list = students.map((s) => {
    const r0 = byStudent.get(s.id);
    return {
      student: s,
      result: r0
        ? {
            id: r0.id,
            completed_at: r0.completed_at,
            overall: r0.report.overall,
            weather: r0.report.weather,
            domains: r0.report.domains,
            attention: r0.report.attention,
            has_ai: !!r0.ai,
          }
        : null,
    };
  });
  res.json({
    campaign,
    klass: { id: klass.id, name: klass.name, grade: klass.grade },
    summary: aggregateClass(rows, students.length),
    students: list,
  });
});

r.get('/psych/results/:id', (req, res) => {
  const { row, campaign, klass } = resultOwned(req, req.params.id);
  const student = one('SELECT id, name, number, avatar FROM students WHERE id = ?', row.student_id);
  res.json({ ...parseResult(row), campaign, klass: { id: klass.id, name: klass.name, grade: klass.grade }, student, aiAvailable: aiAvailable() && !!klass.ai_enabled });
});

r.patch('/psych/results/:id', (req, res) => {
  const { row } = resultOwned(req, req.params.id);
  run('UPDATE psych_results SET teacher_note = ? WHERE id = ?', String(req.body?.teacher_note || '').slice(0, 2000) || null, row.id);
  res.json({ ok: true });
});

r.delete('/psych/results/:id', (req, res) => {
  const { row } = resultOwned(req, req.params.id);
  run('DELETE FROM psych_results WHERE id = ?', row.id);
  for (const d of Object.values(JSON.parse(row.drawings_json))) {
    removeImage(d.image);
    removeImage(d.thumb);
  }
  res.json({ ok: true });
});

r.get('/psych/results/:id/drawing/:kind', (req, res) => {
  const { row } = resultOwned(req, req.params.id);
  const d = JSON.parse(row.drawings_json)[req.params.kind];
  if (!d) throw new HttpError(404, '그림이 없습니다.');
  sendImage(res, req.query.thumb ? d.thumb || d.image : d.image);
});

r.post('/psych/results/:id/ai-summary', async (req, res) => {
  const { row, klass } = resultOwned(req, req.params.id);
  if (!klass.ai_enabled) throw new HttpError(403, '이 학급은 AI 기능이 꺼져 있어요. 학급 설정에서 켤 수 있습니다.');
  if (!aiAvailable()) throw new HttpError(503, 'AI 기능이 설정되지 않았습니다. (ANTHROPIC_API_KEY 필요)');
  consumeAiQuota(`class:${klass.id}`);
  const result = parseResult(row);
  const drawings = [];
  for (const k of DRAWING_STEPS) {
    const d = result.drawings[k];
    const p = d && imagePath(d.thumb || d.image);
    if (!p || !fs.existsSync(p)) continue;
    drawings.push({
      kind: k,
      label: PSYCH_STEPS.find((s) => s.key === k).title.replace(' 그리기', ''),
      mediaType: p.endsWith('.png') ? 'image/png' : 'image/jpeg',
      base64: fs.readFileSync(p).toString('base64'),
    });
  }
  const ai = await summarizePsych({ drawings, answerLines: answerLines(result.answers), report: result.report, grade: klass.grade });
  const stored = { ...ai, generatedAt: new Date().toISOString() };
  run('UPDATE psych_results SET ai_json = ? WHERE id = ?', JSON.stringify(stored), row.id);
  res.json(stored);
});

// ---- 학생 ----
r.get('/student/psych/:id', (req, res) => {
  const { student, klass } = requireStudent(req);
  const c = one('SELECT * FROM psych_campaigns WHERE id = ? AND class_id = ?', Number(req.params.id), klass.id);
  if (!c) throw new HttpError(404, '검사를 찾을 수 없어요.');
  const done = one('SELECT report_json FROM psych_results WHERE campaign_id = ? AND student_id = ?', c.id, student.id);
  res.json({ campaign: c, done: !!done, kid: done ? JSON.parse(done.report_json).kid : null });
});

r.post('/student/psych/:id/submit', (req, res) => {
  const { student, klass } = requireStudent(req);
  const c = one("SELECT * FROM psych_campaigns WHERE id = ? AND class_id = ? AND status = 'open'", Number(req.params.id), klass.id);
  if (!c) throw new HttpError(404, '지금은 참여할 수 없는 검사예요.');
  if (one('SELECT id FROM psych_results WHERE campaign_id = ? AND student_id = ?', c.id, student.id)) throw new HttpError(409, '이미 참여했어요.');
  const answers = cleanAnswers(req.body?.answers);
  const drawings = {};
  const stats = {};
  for (const k of DRAWING_STEPS) {
    const d = req.body?.drawings?.[k];
    if (!d?.image) throw new HttpError(400, '그림이 모두 필요해요.');
    drawings[k] = {
      image: saveDataUrlImage(d.image),
      thumb: d.thumb ? saveDataUrlImage(d.thumb, { maxBytes: 2 * 1024 * 1024 }) : null,
    };
    stats[k] = d.stats && typeof d.stats === 'object' ? d.stats : {};
    drawings[k].stats = stats[k];
  }
  const report = analyzePsych(answers, stats);
  run(
    'INSERT INTO psych_results (campaign_id, student_id, answers_json, drawings_json, report_json) VALUES (?, ?, ?, ?, ?)',
    c.id,
    student.id,
    JSON.stringify(answers),
    JSON.stringify(drawings),
    JSON.stringify(report),
  );
  res.json({ ok: true, kid: report.kid });
});

export default r;
