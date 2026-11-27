// 공개 화면: 랜딩 · 교사 로그인/가입 · 학생 입장
import { api } from '../api.js';
import { h, clear, fill, toast, toastError } from '../ui.js';
import { ANIMALS, FRUITS } from '/shared/login-pictures.js';
import { go, refreshMe, homeFor, session, shell, onLeave } from '../app.js';

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
        h('p', { class: 'center small' }, '학생이라면 ', h('a', { href: '#/student/login' }, '학생 로그인'), '으로 가세요.'),
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
            fill(body, 
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
      h('button', { class: tab === 'qr' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'qr'), onclick: () => { tab = 'qr'; stepStart(); } }, '◻︎ QR 코드'),
      h('button', { class: tab === 'code' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'code'), onclick: () => { tab = 'code'; stepStart(); } }, '# 참여 코드'),
    );
  }

  function stepStart() {
    stopScanner();
    fill(body, 
      dots(0),
      h('h1', null, '학생 로그인'),
      h('p', { class: 'muted', style: { margin: 0 } }, '선생님이 나눠 준 카드로 로그인해요.'),
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
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '카드의 QR 코드를 카메라에 비춰 주세요.'),
      err,
      h('p', { class: 'small faint', style: { margin: '10px 0 0' } }, '아이패드 카메라 앱으로 카드를 비춰도 바로 들어올 수 있어요.'),
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
        onError: (e) => {
          err.textContent = e?.message || String(e);
        },
      });
      await scanner.start();
    } catch (e) {
      err.textContent = e?.message || '카메라를 쓸 수 없어요. 참여 코드로 로그인해 주세요.';
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
        }, h('span', { class: 'pic' }, x.emoji), x.label),
      ),
    );
    fill(body, 
      dots(kind === 'animal' ? 1 : 2),
      h('span', { class: 'avatar lg' }, student.avatar),
      h('h1', { class: 'mt', style: { marginBottom: '4px' } }, kind === 'animal' ? '어떤 동물인가요?' : '어떤 과일인가요?'),
      h('p', { class: 'muted', style: { margin: 0 } }, `${student.name} 학생 · ${student.className}`, h('br'), '카드에 있는 그림을 골라 주세요.'),
      grid,
      err,
      h('button', { class: 'btn ghost mt', onclick: () => (kind === 'fruit' ? stepPicture(code, student, 'animal', {}) : stepStart()) }, '← 이전'),
    );
  }

  if (params.code) {
    fill(body, h('div', { class: 'spinner', style: { margin: '20px auto' } }));
    const ok = await verify(String(params.code).toUpperCase());
    if (!ok) stepStart();
  } else stepStart();
  return root;
}
