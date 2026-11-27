// 데모 데이터 만들기: 관리자 · 학교 · 교사 · 학급 · 학생 · 과제
//   npm run seed
import { openDb, one, all, run } from '../server/db.js';
import { localDay } from '../server/time.js';
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
  // 그림 비밀번호는 학급 공통: 강아지 + 사과
  run("INSERT INTO classes (teacher_id, name, grade, code, login_animal, login_fruit) VALUES (?, '3학년 2반', '초등 3학년', ?, 'dog', 'apple')", teacherId, 'DEMO23');
  klass = one('SELECT * FROM classes WHERE teacher_id = ? AND name = ?', teacherId, '3학년 2반');
  const kids = [
    ['김하늘', 'tone0'], ['이바다', 'tone1'], ['박구름', 'tone2'], ['최별님', 'tone3'],
    ['정나래', 'tone4'], ['한여름', 'tone5'], ['오솔길', 'tone6'], ['윤보라', 'tone7'],
  ];
  kids.forEach(([name, avatar], i) =>
    run(
      'INSERT INTO students (class_id, name, number, pin, avatar, access_code, animal, fruit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      klass.id, name, i + 1, '0000', avatar, `MIA${101 + i}`, 'dog', 'apple',
    ),
  );
  const now = Date.now();
  const iso = (d) => new Date(now + d * 86400_000).toISOString();
  run(
    `INSERT INTO assignments (class_id, title, description, template_ref, orientation, technique, start_at, end_at, steps_json)
     VALUES (?, '귀여운 고양이 색칠하기', '페인트 채우기와 크레용으로 나만의 고양이를 꾸며 보세요!', 'builtin:cat', 'landscape', 'watercolor', ?, ?, ?)`,
    klass.id, iso(-1), iso(6), JSON.stringify(['페인트 채우기로 큰 부분을 먼저 칠해요.', '크레용으로 무늬를 그려요.', '꽃 브러시로 배경을 꾸며요.']),
  );
  run(
    `INSERT INTO assignments (class_id, title, description, orientation, technique, paper, start_at, end_at)
     VALUES (?, '눈 내리는 밤하늘', '유화 붓으로 두툼하게 밤하늘과 눈 덮인 마을을 그려 보세요.', 'landscape', 'oil', 'canvas', ?, ?)`,
    klass.id, iso(-2), iso(5),
  );
  run("INSERT INTO psych_campaigns (class_id, title) VALUES (?, '11월 그림 마음 탐색')", klass.id);

  // 마음 날씨 체크인 기록 (지난 4주, 주말 제외)
  const students = all('SELECT id FROM students WHERE class_id = ?', klass.id);
  const W = [['sunny', 35], ['partly', 25], ['cloudy', 15], ['fog', 7], ['rain', 12], ['storm', 6]];
  const EMO = { sunny: ['happy', 'excited', 'joyful'], partly: ['calm', 'proud'], cloudy: ['bored', 'tired'], fog: ['worried', 'tired'], rain: ['sad', 'upset'], storm: ['angry', 'upset'] };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pickW = () => {
    let r = rnd() * 100;
    for (const [k, w] of W) if ((r -= w) < 0) return k;
    return 'sunny';
  };
  for (let d = 27; d >= 0; d--) {
    const day = new Date(now - d * 86400_000);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const key = localDay(day);
    students.forEach((st, i) => {
      if (rnd() < 0.12 && d !== 0) return;
      let w = pickW();
      if (i === 2 && d <= 2) w = d === 0 ? 'storm' : 'rain';
      const emo = EMO[w].slice(0, 1 + Math.floor(rnd() * 2));
      run(
        'INSERT OR IGNORE INTO checkins (student_id, class_id, day, weather, emotions_json, causes_json, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        st.id, klass.id, key, w, JSON.stringify(emo), JSON.stringify([['friend'], ['family'], ['school'], ['self']][Math.floor(rnd() * 4)]),
        i === 2 && d === 0 ? '친구랑 다퉈서 속상해요' : null,
      );
    });
  }

  run("INSERT INTO boards (teacher_id, class_id, scope, title, description, emoji) VALUES (?, ?, 'class', '3학년 2반 겨울 전시회', '이번 달 우리 반 최고의 작품들', 'snow')", teacherId, klass.id);
  run("INSERT INTO boards (teacher_id, school_id, scope, title, description, emoji) VALUES (?, ?, 'school', '미아트초 작품 전시관', '우리 학교 모든 반이 함께 쓰는 보드', 'school')", teacherId, school.id);
  if (!one('SELECT id FROM testimonials')) {
    run("INSERT INTO testimonials (quote, name, role, sort) VALUES ('예시 후기입니다. 관리자 화면에서 실제 선생님 후기로 바꿔 주세요.', '예시 후기 1', '관리자 › 이용 후기', 1)");
    run("INSERT INTO testimonials (quote, name, role, sort) VALUES ('실제로 받은 후기만, 작성자 동의를 받아 올려 주세요.', '예시 후기 2', '관리자 › 이용 후기', 2)");
  }
}

console.log(`
미아트스쿨 데모 데이터 준비 완료
────────────────────────────────
관리자   admin@miart.school / admin1234
선생님   teacher@miart.school (이메일만 입력하면 로그인)
학교 인증 코드  ${school.invite_code}  (이 코드로 가입한 선생님은 바로 승인)
학생 로그인 (학생 로그인 › 참여 코드 → 동물 → 과일)
  3학년 2반 그림 비밀번호: 강아지 → 사과 (학급 모두 같음)
  김하늘 MIA101  이바다 MIA102  박구름 MIA103  최별님 MIA104
  정나래 MIA105  한여름 MIA106  오솔길 MIA107  윤보라 MIA108
`);
