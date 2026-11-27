// SQLite 저장소 (node:sqlite — 네이티브 모듈 없이 Termux/서버 어디서나 동작)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const IMAGE_DIR = path.join(DATA_DIR, 'images');
export const DRAFT_DIR = path.join(DATA_DIR, 'drafts');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher')),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  school_name TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  code TEXT NOT NULL UNIQUE,
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  gallery_enabled INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  pin TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT 'tone0',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('user','student')),
  subject_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('user','student')),
  owner_id INTEGER NOT NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('photo','ai','upload')),
  image_file TEXT NOT NULL,
  thumb_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  template_ref TEXT,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape','portrait')),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artworks (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '내 그림',
  template_ref TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  image_file TEXT,
  thumb_file TEXT,
  draft_file TEXT,
  stats_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  exhibited INTEGER NOT NULL DEFAULT 0,
  seen_feedback INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_artworks_class ON artworks(class_id, status);
CREATE INDEX IF NOT EXISTS idx_artworks_student ON artworks(student_id);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stamp TEXT,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_artwork ON feedback(artwork_id);

CREATE TABLE IF NOT EXISTS psych_campaigns (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS psych_results (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES psych_campaigns(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  drawings_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  ai_json TEXT,
  teacher_note TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, student_id)
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  weather TEXT NOT NULL,
  emotions_json TEXT NOT NULL DEFAULT '[]',
  causes_json TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, day)
);
CREATE INDEX IF NOT EXISTS idx_checkins_class_day ON checkins(class_id, day);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'class' CHECK (scope IN ('class','school')),
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT 'frame',
  student_posts INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS board_posts (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('user','student')),
  author_id INTEGER NOT NULL,
  artwork_id INTEGER REFERENCES artworks(id) ON DELETE CASCADE,
  image_file TEXT,
  thumb_file TEXT,
  title TEXT NOT NULL DEFAULT '',
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_board ON board_posts(board_id, created_at);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  liker_kind TEXT NOT NULL,
  liker_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, liker_kind, liker_id)
);

CREATE TABLE IF NOT EXISTS teacher_lessons (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('purchase','idea','trial')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  school TEXT,
  teachers INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, day)
);
`;

let db;

export function openDb(file = path.join(DATA_DIR, 'miart.db')) {
  if (db) return db;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// 기존 DB에 새 열 추가 (없을 때만)
function addColumn(d, table, column, ddl) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function migrate(d) {
  addColumn(d, 'students', 'access_code', 'TEXT');
  addColumn(d, 'students', 'animal', 'TEXT');
  addColumn(d, 'students', 'fruit', 'TEXT');
  d.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_students_access_code ON students(access_code)');
  addColumn(d, 'classes', 'checkin_enabled', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(d, 'assignments', 'start_at', 'TEXT');
  addColumn(d, 'assignments', 'end_at', 'TEXT');
  addColumn(d, 'assignments', 'technique', "TEXT NOT NULL DEFAULT 'watercolor'");
  addColumn(d, 'assignments', 'paper', 'TEXT');
  addColumn(d, 'assignments', 'steps_json', 'TEXT');
  addColumn(d, 'assignments', 'materials_json', 'TEXT');
  addColumn(d, 'assignments', 'lesson_id', 'TEXT');
  addColumn(d, 'artworks', 'technique', "TEXT NOT NULL DEFAULT 'watercolor'");
  // 예전 이모지 아바타 → 색상 키 (아이콘은 이름 첫 글자 아바타로 그림)
  d.exec("UPDATE students SET avatar = 'tone' || (id % 8) WHERE avatar NOT LIKE 'tone%'");
}

export function getDb() {
  if (!db) openDb();
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

// 짧은 헬퍼
export const one = (sql, ...params) => getDb().prepare(sql).get(...params);
export const all = (sql, ...params) => getDb().prepare(sql).all(...params);
export const run = (sql, ...params) => getDb().prepare(sql).run(...params);

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}
