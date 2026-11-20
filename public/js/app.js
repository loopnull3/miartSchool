// 미아트스쿨 앱 셸 · 해시 라우터
import { api } from './api.js';
import { h, clear, loading, toastError } from './ui.js';
import * as pub from './views/public.js';
import * as teacher from './views/teacher.js';
import * as student from './views/student.js';
import * as psychT from './views/psych-teacher.js';
import * as psychS from './views/psych-student.js';
import * as admin from './views/admin.js';
import * as tpl from './views/templates.js';
import { drawPage } from './views/draw.js';

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
  ['/', pub.landing, 'any'],
  ['/login', pub.login, 'any'],
  ['/register', pub.register, 'any'],
  ['/join', pub.join, 'any'],
  ['/join/:code', pub.join, 'any'],
  ['/t', teacher.home, 'teacher'],
  ['/t/c/:id', teacher.classPage, 'teacher'],
  ['/t/c/:id/cards', teacher.loginCards, 'teacher'],
  ['/t/c/:id/:tab', teacher.classPage, 'teacher'],
  ['/t/psych/:id', psychT.classReport, 'teacher'],
  ['/t/psych-result/:id', psychT.studentReport, 'teacher'],
  ['/t/account', teacher.account, 'teacher'],
  ['/templates', tpl.templatesPage, 'member'],
  ['/templates/:tab', tpl.templatesPage, 'member'],
  ['/draw', drawPage, 'member'],
  ['/s', student.home, 'student'],
  ['/s/works', student.works, 'student'],
  ['/s/gallery', student.gallery, 'student'],
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
    if (ok) return { handler, role, params };
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
  const path = location.hash.replace(/^#/, '') || '/';
  const m = match(path);
  const me = session.me;
  if (!m) return go(homeFor(me));
  if (m.role === 'teacher' && me.kind !== 'user') return go('/login');
  if (m.role === 'admin' && me.user?.role !== 'admin') return go(me.kind ? homeFor(me) : '/login');
  if (m.role === 'student' && me.kind !== 'student') return go('/join');
  if (m.role === 'member' && !me.kind) return go('/');
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
    clear(app).append(h('div', { class: 'page narrow' }, h('div', { class: 'card center mt-lg' }, h('div', { style: { fontSize: '48px' } }, '😵'), h('h2', null, '문제가 생겼어요'), h('p', { class: 'muted' }, err.message), h('a', { class: 'btn', href: `#${homeFor(me)}` }, '처음으로'))));
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

// 공통 상단바
export function shell(content, { active = '', wide = 'page' } = {}) {
  const me = session.me;
  const nav = h('nav', { class: 'nav' });
  const link = (href, label, key) => nav.append(h('a', { href: `#${href}`, class: active === key ? 'active' : '' }, label));
  let who = null;
  if (me.kind === 'user') {
    if (me.user.role === 'admin') link('/admin', '관리', 'admin');
    link('/t', '내 학급', 'classes');
    link('/templates', '도안 만들기', 'templates');
    link('/draw', '드로잉 체험', 'draw');
    who = h('div', { class: 'who' }, h('a', { href: '#/t/account', class: 'small muted' }, `${me.user.name} 선생님`), h('button', { class: 'btn sm ghost', onclick: logout }, '로그아웃'));
  } else if (me.kind === 'student') {
    link('/s', '홈', 'home');
    link('/s/works', '내 작품', 'works');
    if (me.klass.gallery_enabled) link('/s/gallery', '전시회', 'gallery');
    link('/templates', '도안', 'templates');
    who = h('div', { class: 'who' }, h('span', { class: 'avatar' }, me.student.avatar), h('span', { class: 'hide-sm' }, me.student.name), h('button', { class: 'btn sm ghost', onclick: logout }, '나가기'));
  }
  const bar = h(
    'header',
    { class: 'topbar no-print' },
    h('div', { class: 'topbar-inner' }, h('a', { class: 'brand', href: `#${homeFor(me)}` }, h('img', { src: '/icons/icon.svg', alt: '' }), '미아트스쿨'), nav, h('div', { class: 'spacer' }), who),
  );
  return h('div', null, bar, h('main', { class: wide }, content));
}

window.addEventListener('hashchange', render);
await refreshMe();
render();
