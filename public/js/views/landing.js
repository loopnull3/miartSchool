// 랜딩 페이지 (Apple 스타일)
import { api } from '../api.js';
import { h, clear, fill, modal, toast, icon } from '../ui.js';
import { go, homeFor, onLeave } from '../app.js';
import { SITE } from '/shared/site-config.js';
import { BUILTIN_TEMPLATES, svgDataUrl } from '../templates.js';
import { animateColoring } from '../autocolor.js';

const won = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;

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

function lessonArt(l) {
  const t = l.template && BUILTIN_TEMPLATES.find((x) => x.id === l.template);
  const cover = l.cover || {};
  return h('div', { class: 'lesson-art', style: { background: `linear-gradient(135deg, ${cover.from || '#eef4ff'}, ${cover.to || '#fdeaf3'})` } },
    t ? h('img', { src: svgDataUrl(t.svg), alt: '', loading: 'lazy' }) : h('span', { class: 'lesson-emoji' }, cover.emoji || '🎨'),
    h('span', { class: 'badge' }, l.technique === 'oil' ? '유화' : '수채화'),
  );
}

export function lessonCard(l, onClick) {
  return h('button', { class: 'lesson-card', onclick: onClick },
    lessonArt(l),
    h('div', { class: 'lesson-body' },
      h('div', { class: 'lesson-title' }, l.title),
      h('div', { class: 'lesson-sum' }, l.summary || ''),
      h('div', { class: 'lesson-tags' }, [l.grade, l.season, ...(l.subjects || []).slice(0, 2)].filter(Boolean).map((t) => h('span', { class: 'badge' }, t))),
    ),
  );
}
export { lessonArt };

// 수채화 / 유화 미리보기 애니메이션 (가벼운 자체 렌더링)
function brushDemo(canvas, kind) {
  const ctx = canvas.getContext('2d');
  const W = (canvas.width = 640);
  const H = (canvas.height = 480);
  let t = 0;
  let raf = 0;
  const colors = kind === 'oil' ? ['#1f4e9e', '#f2b134', '#d1495b', '#2a9d8f'] : ['#5ac8fa', '#ff6b4a', '#ffcc00', '#34c759'];
  const reset = () => {
    ctx.fillStyle = kind === 'oil' ? '#f3eee4' : '#fff';
    ctx.fillRect(0, 0, W, H);
    if (kind === 'oil') {
      ctx.globalAlpha = 0.06;
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, W, 1);
      }
      ctx.globalAlpha = 1;
    }
  };
  reset();
  const frame = () => {
    const lane = Math.floor(t / 160) % 4;
    const p = (t % 160) / 160;
    const x = 40 + p * (W - 80);
    const y = 90 + lane * 100 + Math.sin(p * Math.PI * 2) * 22;
    const c = colors[lane];
    if (kind === 'oil') {
      for (let i = 0; i < 9; i++) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.fillStyle = c;
        ctx.fillRect(x - 3, y - 26 + i * 6 + Math.random() * 2, 8, 4);
      }
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 24 + Math.random() * 40, 6, 2);
    } else {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
      g.addColorStop(0, c + '55');
      g.addColorStop(0.7, c + '33');
      g.addColorStop(1, c + '00');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    t += 2;
    if (t % 640 === 0) {
      setTimeout(() => {
        reset();
        raf = requestAnimationFrame(frame);
      }, 1400);
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// 자동 재생 슬라이드 (일시정지 · 진행 막대 · 이전/다음)
function featureSlides(slides) {
  let i = 0;
  let playing = true;
  let start = performance.now();
  const DUR = 5200;
  const stage = h('div', { class: 'fp-stage' });
  const bars = slides.map((_, k) => h('button', { 'aria-label': `${k + 1}번째 화면`, onclick: () => show(k) }, h('span')));
  const playBtn = h('button', { class: 'round-btn', 'aria-label': '일시정지', onclick: () => { playing = !playing; fill(playBtn, icon(playing ? 'pause' : 'play', 16)); playBtn.setAttribute('aria-label', playing ? '일시정지' : '재생'); start = performance.now() - progress * DUR; } }, icon('pause', 16));
  let progress = 0;
  const els = slides.map((s) =>
    h('div', { class: 'fp-slide' },
      h('div', { class: 'fp-caption' }, s.caption),
      h('div', { class: 'shot' }, h('img', { src: s.src, alt: s.caption, loading: 'lazy', onerror: (e) => (e.target.closest('.shot').style.display = 'none') })),
    ),
  );
  stage.append(...els);
  function show(k) {
    i = (k + slides.length) % slides.length;
    els.forEach((e, n) => e.classList.toggle('on', n === i));
    bars.forEach((b, n) => (b.firstChild.style.width = n < i ? '100%' : '0'));
    start = performance.now();
    progress = 0;
  }
  let raf = 0;
  const loop = (now) => {
    if (playing) {
      progress = Math.min(1, (now - start) / DUR);
      bars[i].firstChild.style.width = `${progress * 100}%`;
      if (progress >= 1) show(i + 1);
    }
    raf = requestAnimationFrame(loop);
  };
  show(0);
  raf = requestAnimationFrame(loop);
  const controls = h('div', { class: 'fp-controls' },
    playBtn,
    h('div', { class: 'fp-progress' }, bars),
    h('button', { class: 'round-btn', 'aria-label': '이전', onclick: () => show(i - 1) }, icon('left')),
    h('button', { class: 'round-btn', 'aria-label': '다음', onclick: () => show(i + 1) }, icon('right')),
  );
  return { el: h('div', null, controls, stage), stop: () => cancelAnimationFrame(raf) };
}

function countUp(el, target) {
  const dur = 1200;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = v.toLocaleString('ko-KR');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export async function landingPage({ me }) {
  if (me.kind) {
    go(homeFor(me));
    return null;
  }
  const stops = [];
  onLeave(() => stops.forEach((f) => f()));
  const [site, lessons] = await Promise.all([api.get('/public/site').catch(() => ({ stats: {}, testimonials: [] })), api.get('/public/lessons').catch(() => [])]);

  // 상단바
  const navLinks = [
    ['lessons', '수업 자료'],
    ['features', '주요 기능'],
    ['reviews', '이용 후기'],
    ['pricing', '요금 안내'],
  ].filter(([id]) => id !== 'reviews' || site.testimonials?.length);
  const bar = h('header', { class: 'topbar' },
    h('div', { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, h('img', { src: '/icons/icon.svg', alt: '' }), h('span', null, SITE.brand)),
      h('nav', { class: 'nav', style: { margin: '0 auto' } }, navLinks.map(([id, label]) => h('a', { href: `#${id}`, onclick: (e) => { e.preventDefault(); scrollToId(id); } }, label))),
      h('div', { class: 'who' }, h('a', { class: 'btn sm outline', href: '#/student/login' }, '학생 로그인'), h('a', { class: 'btn sm primary', href: '#/login' }, '교사 로그인')),
    ),
  );

  // 히어로
  const screen = h('canvas', { width: 1200, height: 900, 'aria-label': '도안이 자동으로 색칠되는 모습' });
  const hero = h('section', { class: 'l-hero' },
    h('span', { class: 'eyebrow' }, '준비는 가볍게, 표현은 풍성하게'),
    h('h1', null, '교실에서 시작하는', h('br'), '디지털 미술 수업'),
    h('p', { class: 'lead' }, '아이패드 하나로 그리고, 나누고, 마음까지 살피는 학교용 창작 플랫폼.'),
    h('div', { class: 'cta' },
      h('a', { class: 'btn primary lg', href: '#/register' }, '무료로 시작하기'),
      h('a', { class: 'btn link lg chev', href: '#/try/watercolor' }, '지금 그려 보기'),
    ),
    h('div', { class: 'device' }, h('span', { class: 'cam' }), h('div', { class: 'screen' }, screen)),
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

  // 수업 자료
  const track = h('div', { class: 'carousel-track' });
  for (const l of lessons.slice(0, 14)) track.append(lessonCard(l, () => lessonPreview(l)));
  const scrollBy = (d) => track.scrollBy({ left: d * Math.max(280, track.clientWidth * 0.8), behavior: 'smooth' });
  const lessonsSec = h('section', { class: 'l-section', id: 'lessons', style: { paddingBottom: '70px' } },
    h('div', { class: 'l-head' }, h('span', { class: 'eyebrow' }, '수업 자료'), h('h2', null, '오늘 수업, 바로 꺼내 쓰세요'), h('p', null, '학년·교과·계절별 수업안과 색칠 도안을 그대로 내 수업으로 가져갈 수 있어요.')),
    lessons.length ? h('div', { class: 'carousel' }, track, h('div', { class: 'carousel-nav' }, h('button', { class: 'round-btn', 'aria-label': '이전 수업', onclick: () => scrollBy(-1) }, icon('left')), h('button', { class: 'round-btn', 'aria-label': '다음 수업', onclick: () => scrollBy(1) }, icon('right')))) : null,
  );

  // 주요 기능
  const oilCanvas = h('canvas');
  const waterCanvas = h('canvas');
  stops.push(brushDemo(waterCanvas, 'water'), brushDemo(oilCanvas, 'oil'));
  const slidesCheckin = featureSlides([
    { caption: '학생은 오늘의 마음을 날씨로 골라요', src: '/images/landing/checkin-student.jpg' },
    { caption: '선생님은 달력으로 우리 반 마음을 한눈에', src: '/images/landing/checkin-calendar.jpg' },
    { caption: '한 달 동안의 마음 변화를 그래프로', src: '/images/landing/checkin-chart.jpg' },
  ]);
  const slidesGallery = featureSlides([
    { caption: '반별·학교별 갤러리보드', src: '/images/landing/boards-list.jpg' },
    { caption: '친구 작품을 보고 하트로 응원해요', src: '/images/landing/board-detail.jpg' },
    { caption: '내 작품을 골라 바로 올려요', src: '/images/landing/board-post.jpg' },
  ]);
  const slidesLogin = featureSlides([
    { caption: 'QR 카드를 비추면 바로 로그인', src: '/images/landing/login-qr.jpg' },
    { caption: '비밀번호 대신 동물과 과일 그림', src: '/images/landing/login-picture.jpg' },
    { caption: '선생님은 로그인 카드를 한 번에 인쇄', src: '/images/landing/login-cards.jpg' },
  ]);
  stops.push(slidesCheckin.stop, slidesGallery.stop, slidesLogin.stop);

  const features = h('section', { class: 'l-section gray', id: 'features' },
    h('div', { class: 'l-inner' },
      h('div', { class: 'l-head', style: { marginBottom: '10px' } }, h('h2', null, '선생님의 수업을', h('br'), '더 똑똑하게 도와드려요')),
      h('div', { class: 'feature-panel blue' },
        h('span', { class: 'eyebrow' }, '디지털 창작 도구'),
        h('h3', null, '수채화부터 유화까지, 교실에 꼭 맞춘 도구'),
        h('p', { class: 'sub' }, '번지는 물감, 두툼한 붓 터치까지. 설치도 결제도 없이 지금 바로 써 보세요.'),
        h('div', { class: 'try-cards mt-lg' },
          h('div', { class: 'try-card' }, h('h4', null, '수채화'), waterCanvas, h('a', { class: 'btn primary block mt', href: '#/try/watercolor' }, '체험하기')),
          h('div', { class: 'try-card' }, h('h4', null, '유화'), oilCanvas, h('a', { class: 'btn primary block mt', href: '#/try/oil' }, '체험하기')),
        ),
        h('div', { class: 'try-guide' },
          h('div', null, h('span', { class: 'ck' }, '✓'), '원하는 화풍의 ', h('b', null, '체험하기'), ' 버튼을 눌러 보세요.'),
          h('div', null, h('span', { class: 'ck' }, '✓'), '회원가입이나 설치 없이 ', h('b', { style: { color: 'var(--primary)' } }, '바로 그릴 수 있어요.')),
        ),
      ),
      h('div', { class: 'feature-panel mint' },
        h('span', { class: 'eyebrow', style: { color: '#1f9d55' } }, '마음 날씨 체크인'),
        h('h3', null, '아이들의 마음을 날마다 살펴요'),
        h('p', { class: 'sub' }, '오늘의 날씨로 기분을 남기면, 달력과 그래프로 변화를 한눈에 볼 수 있어요.'),
        slidesCheckin.el,
      ),
      h('div', { class: 'feature-panel violet' },
        h('span', { class: 'eyebrow', style: { color: '#8944ab' } }, '갤러리보드'),
        h('h3', null, '모든 작품이 전시회가 돼요'),
        h('p', { class: 'sub' }, '우리 반, 우리 학교 보드에 작품을 올리고 서로 응원해요. 보드마다 볼 수 있는 사람을 정할 수 있어요.'),
        slidesGallery.el,
      ),
      h('div', { class: 'feature-panel gray' },
        h('span', { class: 'eyebrow', style: { color: 'var(--ink-2)' } }, '간편 로그인'),
        h('h3', null, '개인정보 없이, 카드 한 장으로'),
        h('p', { class: 'sub' }, 'QR 카드를 비추고 동물과 과일 그림만 고르면 끝. 학생 이메일도 비밀번호도 필요 없어요.'),
        slidesLogin.el,
      ),
    ),
  );

  // 통계
  const s = site.stats || {};
  const statEls = [
    [s.schools, '함께하는 학교'],
    [s.teachers, '선생님'],
    [s.artworks, '누적 학생 작품'],
    [s.today, '오늘 올라온 작품'],
  ].map(([v, l]) => ({ v: v || 0, el: h('div', { class: 'v' }, '0'), l }));
  const statsSec = h('section', { class: 'l-section' },
    h('div', { class: 'l-inner' },
      h('div', { class: 'l-head' }, h('span', { class: 'eyebrow' }, '함께하는 교실'), h('h2', null, '지금 미아트스쿨에서', h('br'), '그려지고 있는 작품들')),
      h('div', { class: 'stats-row' }, statEls.map((x) => h('div', { class: 's' }, x.el, h('div', { class: 'l' }, x.l)))),
    ),
  );
  const sio = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      statEls.forEach((x) => countUp(x.el, x.v));
      sio.disconnect();
    }
  });
  sio.observe(statsSec);
  stops.push(() => sio.disconnect());

  // 후기
  const reviews = site.testimonials || [];
  const reviewCard = (t) => h('div', { class: 'review' }, h('div', { class: 'q' }, t.quote), h('div', { class: 'who2' }, h('b', null, t.name), t.role || ''));
  const reviewsSec = reviews.length
    ? h('section', { class: 'l-section gray', id: 'reviews' },
        h('div', { class: 'l-head' }, h('span', { class: 'eyebrow' }, '이용 후기'), h('h2', null, '선생님들의 이야기')),
        h('div', { class: 'marquee' }, h('div', { class: 'marquee-track' }, [...reviews, ...reviews].map(reviewCard))),
      )
    : null;

  // 요금
  const pricingSec = h('section', { class: 'l-section', id: 'pricing' },
    h('div', { class: 'l-inner' },
      h('div', { class: 'l-head' }, h('span', { class: 'eyebrow' }, '요금 안내'), h('h2', null, '학교 예산에 맞춰 유연하게'), h('p', null, SITE.pricing.note)),
      h('div', { class: 'pricing' },
        SITE.pricing.plans.map((p) =>
          h('div', { class: `plan ${p.recommended ? 'rec' : ''}` },
            p.recommended ? h('span', { class: 'badge primary rec-badge' }, '추천') : null,
            h('h3', null, p.name),
            h('div', { class: 'tiers' },
              p.tiers.map((t) =>
                h('div', { class: 'tier' },
                  h('div', { class: 't-label' }, t.label, t.discount ? h('span', { class: 'badge primary' }, t.discount) : null),
                  h('div', { class: 't-price' }, won(t.price), h('small', null, ` ${SITE.pricing.unit}`)),
                  t.discount ? h('div', { class: 't-orig' }, won(p.tiers[0].price)) : null,
                ),
              ),
            ),
            h('ul', null, p.features.map((f) => h('li', null, f))),
          ),
        ),
      ),
      h('div', { class: 'center mt-lg' }, h('button', { class: 'btn primary lg', onclick: () => inquiryModal('purchase') }, '이용권 문의하기')),
    ),
  );

  // CTA · 푸터
  const cta = h('section', { class: 'l-cta' },
    h('h2', null, '우리 교실의 변화를', h('br'), '지금 확인해 보세요'),
    h('p', null, '준비 시간은 줄이고, 아이들의 표현 시간은 늘려요.'),
    h('div', { class: 'row center mt-lg' }, h('a', { class: 'btn primary lg', href: '#/register' }, '무료로 시작하기'), h('button', { class: 'btn lg', style: { background: '#2c2c2e', color: '#fff' }, onclick: () => inquiryModal('idea') }, '아이디어 제안하기')),
  );
  const c = SITE.company;
  const foot = h('footer', { class: 'l-foot' },
    h('div', { class: 'l-inner' },
      h('div', { class: 'links' }, h('a', { href: '#/login' }, '교사 로그인'), h('a', { href: '#/student/login' }, '학생 로그인'), h('a', { href: '#/register' }, '가입 신청'), h('a', { href: `mailto:${SITE.contactEmail}` }, '문의하기')),
      c.name ? h('div', null, [c.name, c.ceo && `대표 ${c.ceo}`, c.bizNo && `사업자등록번호 ${c.bizNo}`, c.address, c.phone].filter(Boolean).join('  ·  ')) : null,
      h('div', null, `Copyright © ${new Date().getFullYear()} ${SITE.brand} (${SITE.brandEn}). 모든 권리 보유.`),
    ),
  );

  function lessonPreview(l) {
    modal({
      title: l.title,
      wide: false,
      body: h('div', null, h('div', { style: { borderRadius: '16px', overflow: 'hidden' } }, lessonArt(l)), h('p', { class: 'muted mt' }, l.summary), h('div', { class: 'lesson-tags' }, [l.grade, l.season, ...(l.subjects || [])].filter(Boolean).map((t) => h('span', { class: 'badge' }, t)))),
      actions: [{ label: '닫기' }, { label: '선생님 로그인하고 사용하기', class: 'primary', onClick: () => go('/login') }],
    });
  }

  return h('div', { class: 'landing' }, bar, hero, lessonsSec, features, statsSec, reviewsSec, pricingSec, cta, foot);
}
