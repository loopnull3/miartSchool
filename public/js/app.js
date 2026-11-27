// 미아트스쿨 앱 셸 · 해시 라우터
import { api } from './api.js';
import { h, clear, loading, toastError } from './ui.js';
import * as pub from './views/public.js';
import * as landing from './views/landing.js';
import * as teacher from './views/teacher.js';
import * as student from './views/student.js';
import * as boards from './views/boards.js';
import * as checkin from './views/checkin.js';
import * as lessons from './views/lessons.js';
import * as psychT from './views/psych-teacher.js';
import * as psychS from './views/psych-student.js';
import * as admin from './views/admin.js';
import * as tpl from './views/templates.js';
import { drawPage, tryPage } from './views/draw.js';

const app = document.getElementById('app');
export const session = { me: { kind: null } };

export async function refreshMe() {
  try {
    session.me = await api.get('/auth/me');
  } catch {
    session.me = { kind: null };
  }
  return session.me;
}

export function go(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

export function isTeacher() {
  return session.me.kind === 'user';
}
export function isStudent() {
  return session.me.kind === 'student';
}

// [패턴, 핸들러, 권한]
const ROUTES = [
  ['/', landing.landingPage, 'any'],
  ['/login', pub.login, 'any'],
  ['/register', pub.register, 'any'],
  ['/student/login', pub.studentLogin, 'any'],
  ['/join', pub.studentLogin, 'any'],
  ['/qr/:code', pub.studentLogin, 'any'],
  ['/try/:technique', tryPage, 'any'],
  ['/t', teacher.home, 'teacher'],
  ['/t/c/:id', teacher.classPage, 'teacher'],
  ['/t/c/:id/cards', teacher.loginCards, 'teacher'],
  ['/t/c/:id/:tab', teacher.classPage, 'teacher'],
  ['/t/lessons', lessons.libraryPage, 'teacher'],
  ['/t/lessons/my', lessons.myLessonsPage, 'teacher'],
  ['/t/psych/:id', psychT.classReport, 'teacher'],
  ['/t/psych-result/:id', psychT.studentReport, 'teacher'],
  ['/t/account', teacher.account, 'teacher'],
  ['/boards', boards.boardsPage, 'member'],
  ['/boards/:id', boards.boardPage, 'member'],
  ['/templates', tpl.templatesPage, 'member'],
  ['/templates/:tab', tpl.templatesPage, 'member'],
  ['/draw', drawPage, 'member'],
  ['/s', student.dashboard, 'student'],
  ['/s/assignments', student.assignments, 'student'],
  ['/s/works', student.works, 'student'],
  ['/s/checkin', checkin.studentCheckinPage, 'student'],
  ['/s/psych/:id', psychS.psychTest, 'student'],
  ['/admin', admin.adminPage, 'admin'],
];

function match(path) {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  const parts = clean.split('/');
  for (const [pattern, handler, role] of ROUTES) {
    const pp = pattern.split('/');
    if (pp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, role, params, path: clean };
  }
  return null;
}

export function query() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

let cleanup = null;
export function onLeave(fn) {
  cleanup = fn;
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  if (cleanup) {
    const fn = cleanup;
    cleanup = null;
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  const raw = location.hash.replace(/^#/, '') || '/';
  // 랜딩 페이지 안의 섹션 이동 (#features 등)
  if (!raw.startsWith('/')) {
    if (document.querySelector('.landing')) return;
    location.hash = '/';
    return;
  }
  const m = match(raw);
  const me = session.me;
  if (!m) return go(homeFor(me));
  if (m.role === 'teacher' && me.kind !== 'user') return go('/login');
  if (m.role === 'admin' && me.user?.role !== 'admin') return go(me.kind ? homeFor(me) : '/login');
  if (m.role === 'student' && me.kind !== 'student') return go('/student/login');
  if (m.role === 'member' && !me.kind) return go('/');
  document.body.classList.toggle('is-landing', m.path === '/');
  clear(app).append(loading());
  window.scrollTo(0, 0);
  try {
    const view = await m.handler({ params: m.params, query: query(), me });
    if (seq !== renderSeq) return;
    clear(app);
    if (view) app.append(view);
  } catch (err) {
    if (seq !== renderSeq) return;
    if (err.status === 401) {
      await refreshMe();
      return go(session.me.kind ? homeFor(session.me) : '/');
    }
    clear(app).append(
      h('div', { class: 'page narrow' },
        h('div', { class: 'card center mt-lg' }, h('div', { style: { fontSize: '48px' } }, '😵'), h('h2', null, '문제가 생겼어요'), h('p', { class: 'muted' }, err.message), h('a', { class: 'btn', href: `#${homeFor(me)}` }, '처음으로')),
      ),
    );
    toastError(err);
  }
}

export function homeFor(me) {
  if (me.kind === 'student') return '/s';
  if (me.kind === 'user') return me.user.role === 'admin' ? '/admin' : '/t';
  return '/';
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    /* ignore */
  }
  session.me = { kind: null };
  go('/');
}

// 공통 상단바 (Apple 스타일 유리 막대)
export function shell(content, { active = '', wide = 'page' } = {}) {
  const me = session.me;
  const nav = h('nav', { class: 'nav' });
  const link = (href, label, key) => nav.append(h('a', { href: `#${href}`, class: active === key ? 'active' : '' }, label));
  let who = null;
  if (me.kind === 'user') {
    if (me.user.role === 'admin') link('/admin', '관리', 'admin');
    link('/t', '내 학급', 'classes');
    link('/t/lessons', '수업 자료', 'lessons');
    link('/boards', '갤러리보드', 'boards');
    link('/templates', '도안 만들기', 'templates');
    who = h('div', { class: 'who' }, h('a', { href: '#/t/account', class: 'hide-sm', style: { color: 'var(--ink-2)' } }, `${me.user.name} 선생님`), h('button', { class: 'btn sm ghost', onclick: logout }, '로그아웃'));
  } else if (me.kind === 'student') {
    link('/s', '대시보드', 'home');
    link('/s/assignments', '내 과제', 'assignments');
    link('/s/works', '내 작품', 'works');
    if (me.klass.gallery_enabled) link('/boards', '갤러리보드', 'boards');
    link('/templates', '도안', 'templates');
    who = h('div', { class: 'who' }, h('span', { class: 'avatar sm' }, me.student.avatar), h('span', { class: 'hide-sm' }, me.student.name), h('button', { class: 'btn sm ghost', onclick: logout }, '나가기'));
  } else {
    who = h('div', { class: 'who' }, h('a', { class: 'btn sm outline', href: '#/student/login' }, '학생 로그인'), h('a', { class: 'btn sm primary', href: '#/login' }, '교사 로그인'));
  }
  const bar = h(
    'header',
    { class: 'topbar no-print' },
    h('div', { class: 'topbar-inner' }, h('a', { class: 'brand', href: `#${homeFor(me)}` }, h('img', { src: '/icons/icon.svg', alt: '' }), h('span', null, '미아트스쿨')), nav, h('div', { class: 'spacer' }), who),
  );
  return h('div', null, bar, h('main', { class: wide }, content));
}

window.addEventListener('hashchange', render);
await refreshMe();
render();
