// 공개 화면: 랜딩 · 교사 로그인/가입 · 학생 입장
import { api } from '../api.js';
import { h, clear, toast } from '../ui.js';
import { go, refreshMe, homeFor, session, shell } from '../app.js';

const FEATURES = [
  ['🖌️', '드로잉 스튜디오', '연필·크레파스·수채화·유화·스프레이 등 9가지 브러시, 레이어, 채우기, 스탬프. 애플펜슬 필압과 손바닥 무시를 지원해요.'],
  ['📷', '사진으로 도안 만들기', '사진을 찍으면 바로 색칠 도안(선화)으로 바뀌어요. 사진은 서버로 보내지 않고 기기 안에서 처리해요.'],
  ['✨', 'AI 주제 도안', '"우주를 나는 고래"처럼 말로 설명하면 AI가 색칠 도안을 그려 줘요. 학급별로 켜고 끌 수 있어요.'],
  ['💗', '그림 마음 탐색', '집-나무-사람(HTP) 그림과 마음 날씨 질문으로 아이의 마음을 살펴보고, 학생별·학급 리포트를 받아요.'],
  ['🏫', '학급 · 과제 관리', '학급 코드와 4자리 PIN으로 어린 학생도 쉽게 로그인. 과제를 내고 제출 현황을 한눈에 봐요.'],
  ['🏅', '피드백과 전시회', '"참 잘했어요" 도장과 한마디로 칭찬하고, 멋진 작품은 우리 반 전시회에 걸어 줘요.'],
];

export function landing({ me }) {
  if (me.kind) {
    go(homeFor(me));
    return null;
  }
  const art = h(
    'div',
    { class: 'hero-art', 'aria-hidden': 'true' },
    h('div', { class: 'blob', style: { inset: '6% 4% 8% 8%', background: '#efedff' } }),
    h('div', { class: 'blob', style: { width: '46%', height: '46%', right: '0', top: '4%', background: '#fff1d6', borderRadius: '58% 42% 38% 62% / 52% 44% 56% 48%' } }),
    h('div', { class: 'blob', style: { width: '38%', height: '38%', left: '2%', bottom: '2%', background: '#ddf7f0' } }),
    h('div', {
      class: 'card',
      style: { position: 'absolute', inset: '18% 14% 20% 16%', padding: '0', overflow: 'hidden', transform: 'rotate(-3deg)', display: 'grid', placeItems: 'center', background: '#fff' },
    }, h('img', { src: '/icons/icon.svg', alt: '', style: { width: '58%' } })),
    h('div', { style: { position: 'absolute', right: '8%', bottom: '14%', fontSize: '64px', transform: 'rotate(12deg)' } }, '🖍️'),
    h('div', { style: { position: 'absolute', left: '6%', top: '10%', fontSize: '54px' } }, '🌈'),
    h('div', { style: { position: 'absolute', right: '12%', top: '6%', fontSize: '44px' } }, '⭐'),
  );

  const hero = h(
    'section',
    { class: 'hero' },
    h('div', null,
      h('span', { class: 'badge primary' }, '학교·학원용 디지털 미술 수업'),
      h('h1', { class: 'mt' }, '아이들의 상상력이 ', h('em', null, '쑥쑥'), ' 자라는', h('br'), '미아트스쿨'),
      h('p', { class: 'lead' }, '아이패드·태블릿·크롬북에서 바로 쓰는 드로잉 교실. 도안 만들기부터 그림 마음 탐색, 학급 리포트까지 한 곳에서.'),
      h('div', { class: 'enter-cards' },
        h('a', { class: 'tile c3', href: '#/join' }, h('div', { class: 'tile-emoji' }, '🧒'), h('div', { class: 'tile-title' }, '학생 입장'), h('div', { class: 'tile-sub' }, '학급 코드와 비밀번호로 들어가요')),
        h('a', { class: 'tile c1', href: '#/login' }, h('div', { class: 'tile-emoji' }, '🧑‍🏫'), h('div', { class: 'tile-title' }, '선생님'), h('div', { class: 'tile-sub' }, '로그인 · 가입 신청')),
      ),
    ),
    art,
  );

  const features = h(
    'section',
    { class: 'mt-lg' },
    h('h2', { class: 'center' }, '수업에 필요한 것만 담았어요'),
    h('div', { class: 'grid three mt' },
      FEATURES.map(([e, t, d]) => h('div', { class: 'card flat feature' }, h('div', { class: 'f-emoji' }, e), h('div', null, h('h3', null, t), h('p', { class: 'muted small', style: { margin: 0 } }, d)))),
    ),
  );

  const trust = h(
    'section',
    { class: 'card mt-lg pad-lg' },
    h('div', { class: 'grid two' },
      h('div', null,
        h('h2', null, '🔒 허가된 학교만 사용해요'),
        h('p', { class: 'muted' }, '선생님 계정은 학교 인증 코드로 가입하거나 관리자 승인을 받아야 사용할 수 있어요. 학생은 이메일 없이 학급 코드 + 4자리 PIN으로 로그인하고, 작품은 담임 선생님과 본인만 볼 수 있어요.'),
      ),
      h('div', null,
        h('h2', null, '💡 마음 탐색은 진단이 아니에요'),
        h('p', { class: 'muted' }, '그림 마음 탐색은 아이를 더 잘 이해하기 위한 참고 자료예요. 강점을 먼저 보여 주고, 살펴볼 점은 부드럽게 알려 드려요. AI 요약에는 아이 이름을 보내지 않아요.'),
      ),
    ),
  );

  const foot = h('footer', { class: 'center faint small mt-lg' }, '© 미아트스쿨 · MiArt School');
  return shell(h('div', null, hero, features, trust, foot));
}

function formError() {
  return h('div', { class: 'form-error', role: 'alert' });
}

export function login({ me }) {
  if (me.kind === 'user') {
    go(homeFor(me));
    return null;
  }
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', required: true, placeholder: 'teacher@school.kr' });
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true });
  const err = formError();
  const btn = h('button', { class: 'btn primary block lg', type: 'submit' }, '로그인');
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          await api.post('/auth/login', { email: email.value, password: pw.value });
          await refreshMe();
          go(homeFor(session.me));
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      },
    },
    h('label', { class: 'field' }, '이메일', email),
    h('label', { class: 'field' }, '비밀번호', pw),
    err,
    btn,
  );
  return shell(
    h('div', { class: 'page narrow' },
      h('div', { class: 'card pad-lg mt' },
        h('h1', null, '선생님 로그인'),
        h('p', { class: 'muted' }, '학교(기관)에서 승인된 선생님만 사용할 수 있어요.'),
        form,
        h('p', { class: 'center mt small' }, '처음이신가요? ', h('a', { href: '#/register' }, '가입 신청하기')),
        h('p', { class: 'center small' }, '학생이라면 ', h('a', { href: '#/join' }, '학생 입장'), '으로 가세요.'),
      ),
    ),
    { wide: '' },
  );
}

export function register() {
  const name = h('input', { class: 'input', required: true, maxlength: 40, autocomplete: 'name' });
  const email = h('input', { class: 'input', type: 'email', required: true, autocomplete: 'username' });
  const pw = h('input', { class: 'input', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' });
  const code = h('input', { class: 'input', placeholder: '예) AB12CD34 (없으면 비워 두세요)', maxlength: 12, style: { textTransform: 'uppercase' } });
  const school = h('input', { class: 'input', placeholder: '예) 미아트초등학교', maxlength: 60 });
  const err = formError();
  const btn = h('button', { class: 'btn primary block lg', type: 'submit' }, '가입 신청');
  const body = h('div');
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          const r = await api.post('/auth/register', { name: name.value, email: email.value, password: pw.value, schoolCode: code.value, schoolName: school.value });
          if (r.status === 'active') {
            await refreshMe();
            toast('가입이 완료됐어요. 환영합니다!', 'ok');
            go('/t');
          } else {
            clear(body).append(
              h('div', { class: 'center' },
                h('div', { style: { fontSize: '56px' } }, '📮'),
                h('h2', null, '가입 신청이 접수됐어요'),
                h('p', { class: 'muted' }, '관리자가 승인하면 로그인할 수 있어요. 학교 인증 코드를 받으셨다면 코드를 넣어 다시 가입하면 바로 사용할 수 있어요.'),
                h('a', { class: 'btn', href: '#/login' }, '로그인 화면으로'),
              ),
            );
          }
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      },
    },
    h('label', { class: 'field' }, '이름', name),
    h('label', { class: 'field' }, '이메일', email),
    h('label', { class: 'field' }, '비밀번호 (8자 이상)', pw),
    h('label', { class: 'field' }, '학교 인증 코드', code),
    h('label', { class: 'field' }, '학교(기관) 이름 — 인증 코드가 없을 때', school),
    err,
    btn,
  );
  body.append(h('h1', null, '선생님 가입 신청'), h('p', { class: 'muted' }, '학교 인증 코드가 있으면 바로 사용할 수 있고, 없으면 관리자 승인 후 사용할 수 있어요.'), form);
  return shell(h('div', { class: 'page narrow' }, h('div', { class: 'card pad-lg mt' }, body)), { wide: '' });
}

// 학생 입장: 학급 코드 → 이름 선택 → PIN
export async function join({ params, me }) {
  if (me.kind === 'student') {
    go('/s');
    return null;
  }
  const body = h('div', { class: 'page mid' });
  const root = shell(body, { wide: '' });

  function stepCode(initial = '') {
    const boxes = Array.from({ length: 6 }, (_, i) =>
      h('input', { maxlength: 1, inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': `학급 코드 ${i + 1}번째 글자`, value: initial[i] || '' }),
    );
    const err = formError();
    const submit = async () => {
      const code = boxes.map((b) => b.value.trim().toUpperCase()).join('');
      if (code.length < 6) return;
      err.textContent = '';
      try {
        const data = await api.get(`/join/${encodeURIComponent(code)}`);
        stepPick(code, data);
      } catch (ex) {
        err.textContent = ex.message;
        boxes.forEach((b) => (b.value = ''));
        boxes[0].focus();
      }
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        const v = b.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
        if (v.length > 1) {
          // 붙여넣기
          v.split('').slice(0, 6 - i).forEach((ch, k) => (boxes[i + k].value = ch));
          boxes[Math.min(5, i + v.length)].focus();
        } else {
          b.value = v;
          if (v && i < 5) boxes[i + 1].focus();
        }
        if (boxes.every((x) => x.value)) submit();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'Enter') submit();
      });
    });
    clear(body).append(
      h('div', { class: 'card pad-lg mt center' },
        h('div', { style: { fontSize: '56px' } }, '🎒'),
        h('h1', null, '학급 코드를 넣어 주세요'),
        h('p', { class: 'muted' }, '선생님이 알려 준 6자리 코드예요.'),
        h('div', { class: 'code-input mt' }, boxes),
        err,
        h('button', { class: 'btn primary lg mt', onclick: submit }, '들어가기'),
      ),
    );
    setTimeout(() => boxes[initial ? 5 : 0].focus(), 50);
    if (initial.length === 6) submit();
  }

  function stepPick(code, data) {
    clear(body).append(
      h('div', { class: 'card pad-lg mt' },
        h('div', { class: 'row between' },
          h('div', null, h('h1', { style: { marginBottom: 0 } }, data.klass.name), h('p', { class: 'muted', style: { margin: 0 } }, `${data.klass.school_name ? data.klass.school_name + ' · ' : ''}${data.klass.teacher_name} 선생님`)),
          h('button', { class: 'btn ghost', onclick: () => stepCode() }, '← 코드 다시 넣기'),
        ),
        h('h2', { class: 'mt-lg' }, '내 이름을 눌러 주세요'),
        data.students.length
          ? h('div', { class: 'student-pick' },
              data.students.map((s) => h('button', { onclick: () => stepPin(code, data, s) }, h('span', { class: 'avatar lg' }, s.avatar), s.number ? h('span', { class: 'num' }, `${s.number}번`) : null, s.name)),
            )
          : h('p', { class: 'muted' }, '아직 등록된 학생이 없어요. 선생님께 말씀드려 주세요.'),
      ),
    );
  }

  function stepPin(code, data, student) {
    let pin = '';
    const dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => h('span')));
    const err = formError();
    const update = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const tryLogin = async () => {
      try {
        await api.post('/auth/student-login', { code, studentId: student.id, pin });
        await refreshMe();
        go('/s');
      } catch (ex) {
        err.textContent = ex.message;
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
        pin = '';
        update();
      }
    };
    const press = (d) => {
      if (pin.length >= 4) return;
      pin += d;
      update();
      if (pin.length === 4) tryLogin();
    };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
      k === ''
        ? h('span')
        : h('button', { 'aria-label': k === '⌫' ? '지우기' : k, onclick: () => {
            if (k === '⌫') {
              pin = pin.slice(0, -1);
              update();
            } else press(k);
          } }, k),
    );
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') {
        pin = pin.slice(0, -1);
        update();
      }
    };
    document.addEventListener('keydown', onKey);
    const cleanup = () => document.removeEventListener('keydown', onKey);
    window.addEventListener('hashchange', cleanup, { once: true });
    clear(body).append(
      h('div', { class: 'card pad-lg mt center' },
        h('span', { class: 'avatar lg' }, student.avatar),
        h('h1', { class: 'mt' }, `${student.name}, 안녕!`),
        h('p', { class: 'muted' }, '비밀번호 숫자 4개를 눌러 주세요.'),
        dots,
        h('div', { class: 'keypad' }, keys),
        err,
        h('button', { class: 'btn ghost mt', onclick: () => { cleanup(); stepPick(code, data); } }, '← 다른 이름 고르기'),
      ),
    );
  }

  stepCode((params.code || '').toUpperCase());
  return root;
}
