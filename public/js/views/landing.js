// 랜딩 페이지 (Apple 스타일 · 짧고 차분한 한 페이지)
import { api } from '../api.js';
import { h, modal, toast } from '../ui.js';
import { go, homeFor, onLeave } from '../app.js';
import { SITE } from '/shared/site-config.js';
import { BUILTIN_TEMPLATES, svgDataUrl } from '../templates.js';
import { animateColoring } from '../autocolor.js';
import { appIcon, glyph } from '../icons.js';

const won = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;
const techLabel = (l) => (l.technique === 'oil' ? '유화' : '수채화');

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 문의(이용권 구매 · 아이디어 제안 · 도입 상담)
export function inquiryModal(type = 'purchase') {
  const titles = { purchase: '이용권 도입 문의', idea: '아이디어 제안하기', trial: '도입 상담 신청' };
  const name = h('input', { class: 'input', maxlength: 40, autocomplete: 'name' });
  const email = h('input', { class: 'input', type: 'email', maxlength: 120, autocomplete: 'email' });
  const phone = h('input', { class: 'input', type: 'tel', maxlength: 30, autocomplete: 'tel' });
  const school = h('input', { class: 'input', maxlength: 80, placeholder: '예) 미아트초등학교' });
  const teachers = h('input', { class: 'input', type: 'number', min: 1, max: 999, placeholder: '예) 5' });
  const message = h('textarea', { class: 'input', rows: 4, maxlength: 2000, placeholder: type === 'idea' ? '미아트스쿨에 바라는 점이나 수업 아이디어를 자유롭게 적어 주세요.' : '궁금한 점을 적어 주세요. (선택)' });
  const err = h('div', { class: 'form-error' });
  const body = h('div', { class: 'stack' },
    h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '이름', name), h('label', { class: 'field' }, '이메일', email)),
    type === 'idea' ? null : h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '12px' } }, h('label', { class: 'field' }, '학교·기관', school), h('label', { class: 'field' }, '선생님 수', teachers)),
    type === 'idea' ? null : h('label', { class: 'field' }, '연락처 (선택)', phone),
    h('label', { class: 'field' }, type === 'idea' ? '아이디어' : '문의 내용', message),
    err,
  );
  modal({
    title: titles[type],
    body,
    actions: [
      { label: '취소' },
      {
        label: '보내기',
        class: 'primary',
        onClick: async () => {
          try {
            await api.post('/public/inquiries', { type, name: name.value, email: email.value, phone: phone.value, school: school.value, teachers: teachers.value, message: message.value });
            toast('잘 받았어요. 곧 연락드릴게요!', 'ok');
          } catch (ex) {
            err.textContent = ex.message;
            return true;
          }
        },
      },
    ],
  });
}

// 수업 표지: 도안이 있으면 도안, 없으면 아이콘 (화풍은 카드 아래 한 줄에 적는다)
function lessonArt(l) {
  const t = l.template && BUILTIN_TEMPLATES.find((x) => x.id === l.template);
  const cover = l.cover || {};
  return h('div', { class: 'lesson-art', style: { background: `linear-gradient(135deg, ${cover.from || '#eef4ff'}, ${cover.to || '#fdeaf3'})` } },
    t ? h('img', { src: svgDataUrl(t.svg), alt: '', loading: 'lazy' }) : h('span', { class: 'lesson-emoji' }, appIcon(l.technique === 'oil' ? 'draw' : 'open', 84)),
  );
}

// 수업 카드: 표지 + 제목 + 한 줄 (학년 · 화풍)
export function lessonCard(l, onClick) {
  return h('button', { class: 'lesson-card', type: 'button', onclick: onClick },
    lessonArt(l),
    h('div', { class: 'lesson-body' },
      h('div', { class: 'lesson-title' }, l.title),
      h('div', { class: 'lesson-meta muted small' }, [l.grade, techLabel(l)].filter(Boolean).join(' · ')),
    ),
  );
}
export { lessonArt };

// 수채화 · 유화 붓 자국 (한 번만 그리는 정지 그림)
function brushSample() {
  const W = 960;
  const H = 600;
  const mid = W / 2;
  const canvas = h('canvas', { width: W, height: H, role: 'img', 'aria-label': '수채화와 유화 붓 자국' });
  const ctx = canvas.getContext('2d');
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lanes = [160, 300, 440];
  const wave = (x, x0, y0) => y0 + Math.sin(((x - x0) / (mid - 120)) * Math.PI * 2) * 24;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, mid, H);
  ctx.fillStyle = '#f3eee4';
  ctx.fillRect(mid, 0, mid, H);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(mid, y, mid, 1);
  // 수채화: 번지는 물감
  ctx.globalCompositeOperation = 'multiply';
  ['#5ac8fa', '#ff6b4a', '#ffcc00'].forEach((c, k) => {
    for (let x = 60; x <= mid - 60; x += 7) {
      const y = wave(x, 60, lanes[k]);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
      g.addColorStop(0, `${c}55`);
      g.addColorStop(0.7, `${c}33`);
      g.addColorStop(1, `${c}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  // 유화: 두툼한 붓 터치
  ['#1f4e9e', '#f2b134', '#d1495b'].forEach((c, k) => {
    for (let x = mid + 60; x <= W - 60; x += 5) {
      const y = wave(x, mid + 60, lanes[k]);
      ctx.fillStyle = c;
      for (let i = 0; i < 9; i++) {
        ctx.globalAlpha = 0.5 + rnd() * 0.5;
        ctx.fillRect(x - 3, y - 26 + i * 6 + rnd() * 2, 8, 4);
      }
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 24 + rnd() * 40, 6, 2);
    }
  });
  ctx.globalAlpha = 1;
  return canvas;
}

function featureCard({ tint, media, title, text, links }) {
  return h('article', { class: 'lp-feature' },
    h('div', { class: 'lp-media', style: { background: tint } }, h('div', { class: 'lp-shot' }, media)),
    h('div', { class: 'lp-ftext' },
      h('h3', null, title),
      h('p', null, text),
      links ? h('div', { class: 'lp-links' }, links) : null,
    ),
  );
}

const shot = (src, alt) => h('img', { src, alt, loading: 'lazy', decoding: 'async' });
const chevLink = (href, label) => h('a', { href }, label, glyph('right', 14, 2.2));

export async function landingPage({ me }) {
  if (me.kind) {
    go(homeFor(me));
    return null;
  }
  const stops = [];
  onLeave(() => stops.forEach((f) => f()));
  const [site, lessons] = await Promise.all([api.get('/public/site').catch(() => ({ testimonials: [] })), api.get('/public/lessons').catch(() => [])]);
  const shownLessons = lessons.slice(0, 6);
  const reviews = (site.testimonials || []).slice(0, 3);

  // 상단바: 메뉴 3개 + 로그인
  const navLinks = [
    ['lessons', '수업 자료'],
    ['features', '기능'],
    ['pricing', '요금'],
  ].filter(([id]) => id !== 'lessons' || shownLessons.length);
  const bar = h('header', { class: 'topbar' },
    h('div', { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, h('img', { src: '/icons/icon.svg', alt: '' }), h('span', null, SITE.brand)),
      h('nav', { class: 'nav lp-nav', 'aria-label': '랜딩 메뉴' }, navLinks.map(([id, label]) => h('a', { href: `#${id}`, onclick: (e) => { e.preventDefault(); scrollToId(id); } }, label))),
      h('div', { class: 'who lp-who' }, h('a', { class: 'btn sm outline', href: '#/student/login' }, '학생 로그인'), h('a', { class: 'btn sm primary', href: '#/login' }, '교사 로그인')),
    ),
  );

  // 히어로: 도안이 저절로 색칠되는 아이패드
  const screen = h('canvas', { width: 1200, height: 900, 'aria-label': '도안이 자동으로 색칠되는 모습' });
  const hero = h('section', { class: 'lp-hero' },
    h('h1', null, '교실에서 시작하는', h('br'), '디지털 미술 수업'),
    h('p', { class: 'lp-lead' }, '아이패드 하나로 그리고, 나누고, 마음까지 살펴요.'),
    h('div', { class: 'lp-cta' },
      h('a', { class: 'btn primary lg', href: '#/register' }, '무료로 시작하기'),
      h('a', { class: 'btn lg lp-soft', href: '#/try/watercolor' }, '그려 보기'),
    ),
    h('div', { class: 'lp-device' }, h('span', { class: 'cam' }), h('div', { class: 'screen' }, screen)),
  );
  const heroSvgs = ['builtin:cat', 'builtin:castle', 'builtin:rocket', 'builtin:sailboat', 'builtin:butterfly']
    .map((id) => BUILTIN_TEMPLATES.find((t) => t.id === id)?.svg)
    .filter(Boolean);
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (e.isIntersecting && !screen.dataset.started) {
        screen.dataset.started = '1';
        stops.push(animateColoring(screen, heroSvgs, { interval: 130 }));
      }
    }
  });
  io.observe(screen);
  stops.push(() => io.disconnect());

  // 수업 자료: 카드 6개
  const lessonsSec = shownLessons.length
    ? h('section', { class: 'lp-section', id: 'lessons' },
        h('div', { class: 'lp-inner' },
          h('h2', { class: 'lp-title' }, '오늘 수업, 바로 꺼내 쓰세요'),
          h('div', { class: 'lp-lessons' }, shownLessons.map((l) => lessonCard(l, () => lessonPreview(l)))),
        ),
      )
    : null;

  // 기능: 카드 4장
  const features = h('section', { class: 'lp-section gray', id: 'features' },
    h('div', { class: 'lp-inner' },
      h('h2', { class: 'lp-title' }, '수업에 필요한 것만 담았어요'),
      h('div', { class: 'lp-features' },
        featureCard({
          tint: '#eef4ff',
          media: brushSample(),
          title: '수채화·유화 드로잉',
          text: '번지는 물감도, 두툼한 붓 터치도 설치 없이 바로 그려요.',
          links: [chevLink('#/try/watercolor', '수채화 그려 보기'), chevLink('#/try/oil', '유화 그려 보기')],
        }),
        featureCard({
          tint: '#e9faf4',
          media: shot('/images/landing/checkin-calendar.jpg', '마음 날씨 달력 화면'),
          title: '마음 날씨',
          text: '오늘 기분을 날씨로 남기면, 우리 반 마음이 달력에 모여요.',
        }),
        featureCard({
          tint: '#f2efff',
          media: shot('/images/landing/boards-list.jpg', '갤러리보드 목록 화면'),
          title: '갤러리보드',
          text: '우리 반, 우리 학교 보드에 작품을 걸고 서로 응원해요.',
        }),
        featureCard({
          tint: '#fff4e5',
          media: shot('/images/landing/login-picture.jpg', '그림으로 로그인하는 화면'),
          title: '그림으로 로그인',
          text: '비밀번호 대신 동물과 과일 그림을 골라 들어와요.',
        }),
      ),
    ),
  );

  // 이용 후기: 있을 때만, 최대 3개
  const reviewsSec = reviews.length
    ? h('section', { class: 'lp-section', id: 'reviews' },
        h('div', { class: 'lp-inner' },
          h('h2', { class: 'lp-title' }, '선생님들의 이야기'),
          h('div', { class: 'lp-reviews' }, reviews.map((t) =>
            h('figure', { class: 'lp-review' },
              h('blockquote', null, t.quote),
              h('figcaption', null, h('b', null, t.name), t.role ? h('span', null, t.role) : null),
            ),
          )),
        ),
      )
    : null;

  // 요금
  const plans = SITE.pricing.plans.map((p) => {
    const base = p.tiers[0];
    const discounts = p.tiers.filter((t) => t.discount).map((t) => `${t.label.replace(/^선생님\s*/, '')} ${t.discount}`);
    return h('div', { class: `lp-plan${p.recommended ? ' rec' : ''}` },
      h('div', { class: 'lp-plan-head' }, h('h3', null, p.name), p.recommended ? h('span', { class: 'badge primary' }, '추천') : null),
      h('div', { class: 'lp-plan-for' }, p.audience || base.label),
      h('div', { class: 'lp-price' }, won(base.price), h('small', null, ` ${SITE.pricing.unit}`)),
      discounts.length ? h('div', { class: 'lp-discount' }, discounts.join(' · ')) : null,
      h('ul', null, p.features.map((f) => h('li', null, glyph('check', 14, 2.6), h('span', null, f)))),
    );
  });
  const pricingSec = h('section', { class: 'lp-section', id: 'pricing' },
    h('div', { class: 'lp-inner' },
      h('h2', { class: 'lp-title' }, '요금은 간단하게'),
      h('p', { class: 'lp-sub' }, SITE.pricing.note),
      h('div', { class: 'lp-plans' }, plans),
      h('div', { class: 'lp-center' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => inquiryModal('purchase') }, '이용권 문의하기')),
    ),
  );

  // 마무리 · 푸터
  const cta = h('section', { class: 'lp-close' },
    h('h2', null, '우리 교실에서 시작해 보세요'),
    h('div', { class: 'lp-cta' },
      h('a', { class: 'btn primary lg', href: '#/register' }, '무료로 시작하기'),
      h('button', { class: 'btn lg lp-soft', type: 'button', onclick: () => inquiryModal('idea') }, '아이디어 제안하기'),
    ),
  );
  const c = SITE.company;
  const companyLine = [c.name, c.ceo && `대표 ${c.ceo}`, c.bizNo && `사업자등록번호 ${c.bizNo}`, c.address, c.phone].filter(Boolean).join(' · ');
  const foot = h('footer', { class: 'lp-foot' },
    h('div', { class: 'lp-inner' },
      h('div', { class: 'lp-foot-row' },
        h('span', null, `© ${new Date().getFullYear()} ${SITE.brand}`),
        h('nav', { 'aria-label': '바닥글' }, h('a', { href: '#/login' }, '교사 로그인'), h('a', { href: '#/student/login' }, '학생 로그인'), h('a', { href: `mailto:${SITE.contactEmail}` }, '문의하기')),
      ),
      c.name ? h('div', { class: 'lp-company' }, companyLine) : null,
    ),
  );

  function lessonPreview(l) {
    modal({
      title: l.title,
      body: h('div', null,
        h('div', { style: { borderRadius: '16px', overflow: 'hidden' } }, lessonArt(l)),
        l.summary ? h('p', { class: 'mt' }, l.summary) : null,
        h('p', { class: 'muted small' }, [l.grade, l.season, techLabel(l)].filter(Boolean).join(' · ')),
      ),
      actions: [{ label: '닫기' }, { label: '선생님 로그인하고 사용하기', class: 'primary', onClick: () => go('/login') }],
    });
  }

  return h('div', { class: 'landing' }, bar, hero, lessonsSec, features, reviewsSec, pricingSec, cta, foot);
}
