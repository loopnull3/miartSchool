// 갤러리보드 — 우리 반 / 우리 학교 작품을 안전하게 공유
import { Router } from 'express';
import { one, all, run } from '../db.js';
import { HttpError, requireTeacher } from '../auth.js';
import { saveDataUrlImage, removeImage, sendImage } from '../storage.js';

const r = Router();
const EMOJIS = ['🖼️', '🎨', '🌈', '⭐', '🌸', '❄️', '🎄', '🐾', '🚀', '📚', '🏆', '💡'];

function requireAny(req) {
  if (!req.auth) throw new HttpError(401, '로그인이 필요합니다.');
  return req.auth;
}

function canView(auth, b) {
  if (auth.kind === 'student') {
    if (b.scope === 'class') return b.class_id === auth.klass.id;
    return b.school_id != null && b.school_id === auth.klass.school_id;
  }
  const u = auth.user;
  if (u.role === 'admin' || b.teacher_id === u.id) return true;
  return b.scope === 'school' && b.school_id != null && b.school_id === u.school_id;
}

function canManage(auth, b) {
  return auth.kind === 'user' && (auth.user.role === 'admin' || b.teacher_id === auth.user.id);
}

function getBoard(auth, id) {
  const b = one('SELECT * FROM boards WHERE id = ?', Number(id));
  if (!b || !canView(auth, b)) throw new HttpError(404, '보드를 찾을 수 없어요.');
  return b;
}

function me(auth) {
  return auth.kind === 'student' ? { kind: 'student', id: auth.student.id } : { kind: 'user', id: auth.user.id };
}

function boardSummary(b, auth) {
  const covers = all('SELECT id FROM board_posts WHERE board_id = ? ORDER BY created_at DESC LIMIT 4', b.id).map((p) => p.id);
  const klass = b.class_id ? one('SELECT name FROM classes WHERE id = ?', b.class_id) : null;
  const teacher = one('SELECT name FROM users WHERE id = ?', b.teacher_id);
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    emoji: b.emoji,
    scope: b.scope,
    class_id: b.class_id,
    class_name: klass?.name ?? null,
    teacher_name: teacher?.name ?? null,
    student_posts: !!b.student_posts,
    post_count: one('SELECT COUNT(*) n FROM board_posts WHERE board_id = ?', b.id).n,
    covers,
    can_manage: canManage(auth, b),
    created_at: b.created_at,
  };
}

r.get('/boards', (req, res) => {
  const auth = requireAny(req);
  let rows;
  if (auth.kind === 'student') {
    rows = all(
      `SELECT * FROM boards WHERE (scope = 'class' AND class_id = ?) OR (scope = 'school' AND school_id IS NOT NULL AND school_id = ?)
       ORDER BY created_at DESC`,
      auth.klass.id,
      auth.klass.school_id ?? -1,
    );
  } else if (auth.user.role === 'admin') {
    rows = all('SELECT * FROM boards ORDER BY created_at DESC');
  } else {
    rows = all(
      `SELECT * FROM boards WHERE teacher_id = ? OR (scope = 'school' AND school_id IS NOT NULL AND school_id = ?) ORDER BY created_at DESC`,
      auth.user.id,
      auth.user.school_id ?? -1,
    );
  }
  if (req.query.classId) rows = rows.filter((b) => b.class_id === Number(req.query.classId) || b.scope === 'school');
  res.json(rows.map((b) => boardSummary(b, auth)));
});

r.post('/boards', (req, res) => {
  const user = requireTeacher(req);
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 40);
  if (!title) throw new HttpError(400, '보드 이름을 입력해 주세요.');
  const scope = b.scope === 'school' ? 'school' : 'class';
  let classId = null;
  let schoolId = null;
  if (scope === 'class') {
    const c = one('SELECT * FROM classes WHERE id = ?', Number(b.classId));
    if (!c || (c.teacher_id !== user.id && user.role !== 'admin')) throw new HttpError(400, '보드를 만들 학급을 골라 주세요.');
    classId = c.id;
  } else {
    if (!user.school_id) throw new HttpError(400, '학교 인증 코드로 가입한 선생님만 학교 보드를 만들 수 있어요.');
    schoolId = user.school_id;
  }
  const info = run(
    'INSERT INTO boards (teacher_id, class_id, school_id, scope, title, description, emoji, student_posts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    user.id,
    classId,
    schoolId,
    scope,
    title,
    String(b.description || '').trim().slice(0, 200) || null,
    EMOJIS.includes(b.emoji) ? b.emoji : '🖼️',
    b.studentPosts === false ? 0 : 1,
  );
  res.json(boardSummary(one('SELECT * FROM boards WHERE id = ?', Number(info.lastInsertRowid)), req.auth));
});

r.patch('/boards/:id', (req, res) => {
  const auth = requireAny(req);
  const b = getBoard(auth, req.params.id);
  if (!canManage(auth, b)) throw new HttpError(403, '보드를 만든 선생님만 바꿀 수 있어요.');
  const x = req.body || {};
  run(
    'UPDATE boards SET title = ?, description = ?, emoji = ?, student_posts = ? WHERE id = ?',
    x.title != null ? String(x.title).trim().slice(0, 40) || b.title : b.title,
    x.description != null ? String(x.description).trim().slice(0, 200) || null : b.description,
    EMOJIS.includes(x.emoji) ? x.emoji : b.emoji,
    x.studentPosts != null ? (x.studentPosts ? 1 : 0) : b.student_posts,
    b.id,
  );
  res.json(boardSummary(one('SELECT * FROM boards WHERE id = ?', b.id), auth));
});

r.delete('/boards/:id', (req, res) => {
  const auth = requireAny(req);
  const b = getBoard(auth, req.params.id);
  if (!canManage(auth, b)) throw new HttpError(403, '보드를 만든 선생님만 지울 수 있어요.');
  const files = all('SELECT image_file, thumb_file FROM board_posts WHERE board_id = ?', b.id);
  run('DELETE FROM boards WHERE id = ?', b.id);
  for (const f of files) {
    removeImage(f.image_file);
    removeImage(f.thumb_file);
  }
  res.json({ ok: true });
});

function authorOf(p) {
  if (p.author_kind === 'student') {
    const s = one('SELECT name, avatar FROM students WHERE id = ?', p.author_id);
    return { name: s?.name ?? '알 수 없음', avatar: s?.avatar ?? '🙂', teacher: false };
  }
  const u = one('SELECT name FROM users WHERE id = ?', p.author_id);
  return { name: `${u?.name ?? ''} 선생님`, avatar: '🧑‍🏫', teacher: true };
}

function postView(p, auth) {
  const m = me(auth);
  return {
    id: p.id,
    board_id: p.board_id,
    title: p.title,
    body: p.body,
    author: authorOf(p),
    mine: p.author_kind === m.kind && p.author_id === m.id,
    likes: one('SELECT COUNT(*) n FROM post_likes WHERE post_id = ?', p.id).n,
    liked: !!one('SELECT 1 FROM post_likes WHERE post_id = ? AND liker_kind = ? AND liker_id = ?', p.id, m.kind, m.id),
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

r.get('/boards/:id', (req, res) => {
  const auth = requireAny(req);
  const b = getBoard(auth, req.params.id);
  const posts = all('SELECT * FROM board_posts WHERE board_id = ? ORDER BY created_at DESC', b.id).map((p) => postView(p, auth));
  res.json({ board: boardSummary(b, auth), posts, can_post: auth.kind === 'user' || !!b.student_posts });
});

r.post('/boards/:id/posts', (req, res) => {
  const auth = requireAny(req);
  const b = getBoard(auth, req.params.id);
  if (auth.kind === 'student' && !b.student_posts) throw new HttpError(403, '이 보드는 선생님만 올릴 수 있어요.');
  const x = req.body || {};
  let artworkId = null;
  let image = null;
  let thumb = null;
  if (x.artworkId) {
    const a = one('SELECT * FROM artworks WHERE id = ?', Number(x.artworkId));
    if (!a || !a.image_file) throw new HttpError(400, '올릴 작품을 찾을 수 없어요.');
    if (auth.kind === 'student' && a.student_id !== auth.student.id) throw new HttpError(403, '내 작품만 올릴 수 있어요.');
    if (auth.kind === 'user' && auth.user.role !== 'admin') {
      const c = one('SELECT teacher_id FROM classes WHERE id = ?', a.class_id);
      if (c?.teacher_id !== auth.user.id) throw new HttpError(403, '내 학급 작품만 올릴 수 있어요.');
    }
    artworkId = a.id;
  } else if (x.image) {
    image = saveDataUrlImage(x.image);
    thumb = x.thumb ? saveDataUrlImage(x.thumb, { maxBytes: 2 * 1024 * 1024 }) : null;
  } else throw new HttpError(400, '작품이나 사진을 골라 주세요.');
  const m = me(auth);
  const info = run(
    'INSERT INTO board_posts (board_id, author_kind, author_id, artwork_id, image_file, thumb_file, title, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    b.id,
    m.kind,
    m.id,
    artworkId,
    image,
    thumb,
    String(x.title || '').trim().slice(0, 40),
    String(x.body || '').trim().slice(0, 500) || null,
  );
  res.json(postView(one('SELECT * FROM board_posts WHERE id = ?', Number(info.lastInsertRowid)), auth));
});

function getPost(auth, id) {
  const p = one('SELECT * FROM board_posts WHERE id = ?', Number(id));
  if (!p) throw new HttpError(404, '게시물을 찾을 수 없어요.');
  const b = getBoard(auth, p.board_id);
  return { p, b };
}

r.patch('/posts/:id', (req, res) => {
  const auth = requireAny(req);
  const { p } = getPost(auth, req.params.id);
  const m = me(auth);
  if (p.author_kind !== m.kind || p.author_id !== m.id) throw new HttpError(403, '내가 올린 글만 고칠 수 있어요.');
  run(
    "UPDATE board_posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?",
    req.body?.title != null ? String(req.body.title).trim().slice(0, 40) : p.title,
    req.body?.body != null ? String(req.body.body).trim().slice(0, 500) || null : p.body,
    p.id,
  );
  res.json(postView(one('SELECT * FROM board_posts WHERE id = ?', p.id), auth));
});

r.delete('/posts/:id', (req, res) => {
  const auth = requireAny(req);
  const { p, b } = getPost(auth, req.params.id);
  const m = me(auth);
  if (!(p.author_kind === m.kind && p.author_id === m.id) && !canManage(auth, b)) throw new HttpError(403, '지울 수 없는 게시물이에요.');
  run('DELETE FROM board_posts WHERE id = ?', p.id);
  removeImage(p.image_file);
  removeImage(p.thumb_file);
  res.json({ ok: true });
});

r.post('/posts/:id/like', (req, res) => {
  const auth = requireAny(req);
  const { p } = getPost(auth, req.params.id);
  const m = me(auth);
  const had = one('SELECT 1 FROM post_likes WHERE post_id = ? AND liker_kind = ? AND liker_id = ?', p.id, m.kind, m.id);
  if (had) run('DELETE FROM post_likes WHERE post_id = ? AND liker_kind = ? AND liker_id = ?', p.id, m.kind, m.id);
  else run('INSERT INTO post_likes (post_id, liker_kind, liker_id) VALUES (?, ?, ?)', p.id, m.kind, m.id);
  res.json(postView(p, auth));
});

r.get('/posts/:id/image', (req, res) => {
  const auth = requireAny(req);
  const { p } = getPost(auth, req.params.id);
  if (p.artwork_id) {
    const a = one('SELECT image_file, thumb_file FROM artworks WHERE id = ?', p.artwork_id);
    return sendImage(res, req.query.thumb ? a?.thumb_file || a?.image_file : a?.image_file);
  }
  sendImage(res, req.query.thumb ? p.thumb_file || p.image_file : p.image_file);
});

export default r;
