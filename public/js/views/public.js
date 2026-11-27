// 공개 화면: 랜딩 · 교사 로그인/가입 · 학생 입장
import { api } from '../api.js';
import { h, clear, fill, toast, toastError } from '../ui.js';
import { ANIMALS, FRUITS } from '/shared/login-pictures.js';
import { appIcon, glyph, animalIcon, fruitIcon, avatarEl } from '../icons.js';
import { go, refreshMe, homeFor, session, shell, onLeave } from '../app.js';

function formError() {
  return h('div', { class: 'form-error', role: 'alert' });
}

// 선생님 로그인: 이메일만 입력. 관리자 계정이면 비밀번호 칸이 나타난다.
export function login({ me }) {
  if (me.kind === 'user') {
    go(homeFor(me));
    return null;
  }
  const email = h('input', { class: 'input lg', type: 'email', autocomplete: 'username', required: true, placeholder: '이메일 주소', 'aria-label': '이메일' });
  const pw = h('input', { class: 'input lg', type: 'password', autocomplete: 'current-password', placeholder: '비밀번호', 'aria-label': '비밀번호' });
  const pwField = h('div', { hidden: true }, pw);
  const err = formError();
  const btn = h('button', { class: 'btn primary block lg', type: 'submit' }, '로그인');
  api.get('/auth/config').then((c) => {
    if (!c.teacherEmailOnly) pwField.hidden = false;
  }).catch(() => {});
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          await api.post('/auth/login', pwField.hidden ? { email: email.value } : { email: email.value, password: pw.value });
          await refreshMe();
          go(homeFor(session.me));
        } catch (ex) {
          if (ex.data?.needPassword && pwField.hidden) {
            pwField.hidden = false;
            pw.focus();
          } else err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      },
    },
    email,
    pwField,
    err,
    btn,
  );
  return shell(
    h('div', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' },
        appIcon('classes', 56),
        h('h1', null, '선생님 로그인'),
        form,
        h('div', { class: 'auth-links' }, h('a', { href: '#/register' }, '가입하기'), h('span', null, '·'), h('a', { href: '#/student/login' }, '학생 로그인')),
      ),
    ),
    { wide: '' },
  );
}

export function register() {
  const name = h('input', { class: 'input lg', required: true, maxlength: 40, autocomplete: 'name', placeholder: '이름', 'aria-label': '이름' });
  const email = h('input', { class: 'input lg', type: 'email', required: true, autocomplete: 'username', placeholder: '이메일 주소', 'aria-label': '이메일' });
  const pw = h('input', { class: 'input lg', type: 'password', minlength: 8, autocomplete: 'new-password', placeholder: '비밀번호 (8자 이상)', 'aria-label': '비밀번호' });
  const pwField = h('div', { hidden: true }, pw);
  const code = h('input', { class: 'input lg', placeholder: '학교 인증 코드 (있으면)', 'aria-label': '학교 인증 코드', maxlength: 12, style: { textTransform: 'uppercase' } });
  const school = h('input', { class: 'input lg', placeholder: '학교(기관) 이름', 'aria-label': '학교 이름', maxlength: 60 });
  const err = formError();
  const btn = h('button', { class: 'btn primary block lg', type: 'submit' }, '가입하기');
  api.get('/auth/config').then((c) => {
    if (!c.teacherEmailOnly) {
      pwField.hidden = false;
      pw.required = true;
    }
  }).catch(() => {});
  const body = h('div', { class: 'auth-card' });
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          const payload = { name: name.value, email: email.value, schoolCode: code.value, schoolName: school.value };
          if (!pwField.hidden) payload.password = pw.value;
          const r = await api.post('/auth/register', payload);
          if (r.status === 'active') {
            await refreshMe();
            toast('환영합니다!', 'ok');
            go('/t');
          } else {
            fill(body,
              appIcon('submitted', 56),
              h('h1', null, '신청이 접수됐어요'),
              h('p', { class: 'muted' }, '관리자가 승인하면 이메일로 로그인할 수 있어요.'),
              h('a', { class: 'btn block lg', href: '#/login' }, '로그인 화면으로'),
            );
          }
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      },
    },
    name,
    email,
    pwField,
    code,
    school,
    err,
    btn,
  );
  body.append(
    appIcon('classes', 56),
    h('h1', null, '선생님 가입'),
    h('p', { class: 'muted small' }, '학교 인증 코드가 있으면 바로 시작해요.'),
    form,
    h('div', { class: 'auth-links' }, h('a', { href: '#/login' }, '이미 가입했어요')),
  );
  return shell(h('div', { class: 'auth-wrap' }, body), { wide: '' });
}

// 학생 로그인: [QR 코드 | 참여 코드] → 동물 → 과일
export async function studentLogin({ params, query, me }) {
  if (me.kind === 'student') {
    go('/s');
    return null;
  }
  const body = h('div', { class: 'login-card' });
  const root = shell(h('div', { class: 'login-shell' }, body), { wide: '' });
  let tab = query.tab === 'code' ? 'code' : 'qr';
  let scanner = null;
  const stopScanner = () => {
    try {
      scanner?.stop();
    } catch {
      /* ignore */
    }
    scanner = null;
  };
  onLeave(stopScanner);

  const dots = (n) => h('div', { class: 'step-dots', 'aria-hidden': 'true' }, [0, 1, 2].map((i) => h('span', { class: i === n ? 'on' : '' })));

  function codeFromText(text) {
    const t = String(text || '').trim();
    const m = /#\/qr\/([A-Za-z0-9]{6})/.exec(t) || /^([A-Za-z0-9]{6})$/.exec(t);
    return m ? m[1].toUpperCase() : null;
  }

  async function verify(code, errEl) {
    try {
      const r = await api.post('/auth/student/code', { code });
      stopScanner();
      stepPicture(code, r.student, 'animal', {});
    } catch (ex) {
      if (errEl) errEl.textContent = ex.message;
      else toastError(ex);
      return false;
    }
    return true;
  }

  function tabs() {
    return h('div', { class: 'segmented lg', role: 'tablist', style: { margin: '18px 0 6px' } },
      h('button', { class: tab === 'qr' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'qr'), onclick: () => { tab = 'qr'; stepStart(); } }, glyph('qr', 16), ' QR 코드'),
      h('button', { class: tab === 'code' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'code'), onclick: () => { tab = 'code'; stepStart(); } }, glyph('hash', 16), ' 참여 코드'),
    );
  }

  function stepStart() {
    stopScanner();
    fill(body, 
      dots(0),
      h('h1', null, '학생 로그인'),
      tabs(),
    );
    if (tab === 'qr') renderQr();
    else renderCode();
  }

  async function renderQr() {
    const box = h('div', { class: 'scanner-box' });
    const err = formError();
    body.append(
      box,
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '카드의 QR을 비춰 주세요'),
      err,
    );
    try {
      const { createScanner } = await import('../qr.js');
      if (tab !== 'qr' || !box.isConnected) return;
      scanner = createScanner(box, {
        onResult: async (text) => {
          const code = codeFromText(text);
          if (!code) {
            err.textContent = '미아트스쿨 로그인 카드가 아니에요.';
            return;
          }
          await verify(code, err);
        },
        onError: () => {},
      });
      if (!(await scanner.start())) throw new Error('camera');
    } catch {
      // 카메라가 없거나 막혀 있으면 참여 코드 입력으로 바로 넘어간다
      if (tab !== 'qr' || !box.isConnected) return;
      tab = 'code';
      stepStart();
      body.append(h('p', { class: 'small faint', style: { margin: '4px 0 0' } }, '카메라를 쓸 수 없어서 참여 코드로 들어가요.'));
    }
  }

  function renderCode() {
    const boxes = Array.from({ length: 6 }, (_, i) =>
      h('input', { maxlength: 1, inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', 'aria-label': `참여 코드 ${i + 1}번째 글자` }),
    );
    const err = formError();
    const submit = async () => {
      const code = boxes.map((b) => b.value.trim().toUpperCase()).join('');
      if (code.length < 6) return;
      err.textContent = '';
      const ok = await verify(code, err);
      if (!ok) {
        boxes.forEach((b) => (b.value = ''));
        boxes[0].focus();
      }
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        const v = b.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
        if (v.length > 1) {
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
    body.append(
      h('div', { class: 'code-input', style: { margin: '24px 0 8px' } }, boxes),
      err,
      h('button', { class: 'btn primary lg block mt', onclick: submit }, '다음'),
    );
    setTimeout(() => boxes[0].focus(), 50);
  }

  function stepPicture(code, student, kind, picks) {
    const list = kind === 'animal' ? ANIMALS : FRUITS;
    const err = formError();
    const grid = h('div', { class: 'picture-grid' },
      list.map((x) =>
        h('button', {
          'aria-label': x.label,
          onclick: async (e) => {
            e.currentTarget.classList.add('on');
            if (kind === 'animal') {
              setTimeout(() => stepPicture(code, student, 'fruit', { animal: x.key }), 160);
              return;
            }
            try {
              await api.post('/auth/student/login', { code, animal: picks.animal, fruit: x.key });
              await refreshMe();
              go('/s');
            } catch (ex) {
              if (ex.status === 429) {
                err.textContent = ex.message;
                return;
              }
              toastError(ex);
              grid.classList.remove('shake');
              void grid.offsetWidth;
              grid.classList.add('shake');
              setTimeout(() => stepPicture(code, student, 'animal', {}), 600);
            }
          },
        }, h('span', { class: 'pic' }, kind === 'animal' ? animalIcon(x.key, 76) : fruitIcon(x.key, 76)), x.label),
      ),
    );
    fill(body, 
      dots(kind === 'animal' ? 1 : 2),
      avatarEl({ name: student.name, id: student.id }, 72),
      h('h1', { class: 'mt', style: { marginBottom: '4px' } }, kind === 'animal' ? '어떤 동물인가요?' : '어떤 과일인가요?'),
      h('p', { class: 'muted', style: { margin: 0 } }, `${student.name} · ${student.className}`),
      grid,
      err,
      h('button', { class: 'btn ghost mt', onclick: () => (kind === 'fruit' ? stepPicture(code, student, 'animal', {}) : stepStart()) }, glyph('left', 16), ' 이전'),
    );
  }

  if (params.code) {
    fill(body, h('div', { class: 'spinner', style: { margin: '20px auto' } }));
    const ok = await verify(String(params.code).toUpperCase());
    if (!ok) stepStart();
  } else stepStart();
  return root;
}
