// 데모 데이터 만들기: 관리자 · 학교 · 교사 · 학급 · 학생 · 과제
//   npm run seed
import { openDb, one, run } from '../server/db.js';
import { hashPassword, randomCode } from '../server/auth.js';

openDb();

function upsertUser({ role, email, name, password, schoolId = null, schoolName = null }) {
  const found = one('SELECT id FROM users WHERE email = ?', email);
  if (found) return found.id;
  return Number(
    run(
      "INSERT INTO users (role, email, name, school_id, school_name, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      role,
      email,
      name,
      schoolId,
      schoolName,
      hashPassword(password),
    ).lastInsertRowid,
  );
}

let school = one("SELECT * FROM schools WHERE name = '미아트초등학교'");
if (!school) {
  run('INSERT INTO schools (name, invite_code) VALUES (?, ?)', '미아트초등학교', randomCode(8));
  school = one("SELECT * FROM schools WHERE name = '미아트초등학교'");
}

upsertUser({ role: 'admin', email: 'admin@miart.school', name: '관리자', password: 'admin1234' });
const teacherId = upsertUser({ role: 'teacher', email: 'teacher@miart.school', name: '김미술', password: 'teacher1234', schoolId: school.id, schoolName: school.name });

let klass = one('SELECT * FROM classes WHERE teacher_id = ? AND name = ?', teacherId, '3학년 2반');
if (!klass) {
  run("INSERT INTO classes (teacher_id, name, grade, code) VALUES (?, '3학년 2반', '초등 3학년', ?)", teacherId, 'DEMO23');
  klass = one('SELECT * FROM classes WHERE teacher_id = ? AND name = ?', teacherId, '3학년 2반');
  const kids = [
    ['김하늘', '🐰'], ['이바다', '🐳'], ['박구름', '🐻'], ['최별님', '🦊'], ['정나래', '🦋'], ['한여름', '🐯'], ['오솔길', '🐸'], ['윤보라', '🦄'],
  ];
  kids.forEach(([name, avatar], i) => run('INSERT INTO students (class_id, name, number, pin, avatar) VALUES (?, ?, ?, ?, ?)', klass.id, name, i + 1, String(1111 * ((i % 9) + 1)).slice(0, 4), avatar));
  run(
    "INSERT INTO assignments (class_id, title, description, template_ref, orientation) VALUES (?, '귀여운 고양이 색칠하기', '채우기 도구와 크레파스로 나만의 고양이를 꾸며 보세요!', 'builtin:cat', 'landscape')",
    klass.id,
  );
  run("INSERT INTO assignments (class_id, title, description, orientation) VALUES (?, '내가 살고 싶은 집', '상상 속의 멋진 집을 자유롭게 그려 보세요.', 'landscape')", klass.id);
  run("INSERT INTO psych_campaigns (class_id, title) VALUES (?, '11월 그림 마음 탐색')", klass.id);
}

console.log(`
미아트스쿨 데모 데이터 준비 완료
────────────────────────────────
관리자   admin@miart.school / admin1234
선생님   teacher@miart.school / teacher1234
학교 인증 코드  ${school.invite_code}  (이 코드로 가입한 선생님은 바로 승인)
학급 코드  ${klass.code}  (3학년 2반)
학생 PIN  1번 김하늘 1111, 2번 이바다 2222, 3번 박구름 3333 … (번호 × 1111)
`);
