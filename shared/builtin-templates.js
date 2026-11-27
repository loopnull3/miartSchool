// 미아트스쿨 기본 도안(색칠 그림) 라이브러리
// 브라우저(드로잉 스튜디오)와 서버(키워드 매칭)가 함께 사용하는 순수 ESM 모듈.
//
// 모든 도안 규칙:
//  - viewBox "0 0 800 600", 선은 #222 · 굵기 4~7 · 둥근 끝/이음
//  - 채우기는 none (작은 눈동자/코만 #222, 뒤 선을 가리는 도형만 white)
//  - 아이가 칠할 영역은 모두 닫힌 도형이라 채우기(flood fill)가 새지 않음
//  - svg / g / path / circle / ellipse / rect / line / polyline / polygon 만 사용
//
// 아래 작은 도우미 함수들은 모듈을 불러올 때 한 번만 실행되어 SVG 문자열을 만든다.

// ---------------------------------------------------------------------------
// 도우미
// ---------------------------------------------------------------------------

const f = (n) => Math.round(n * 10) / 10;
const W = ' fill="white"';
const D = ' fill="#222"';

const svg = (body) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">' +
  '<g fill="none" stroke="#222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
  body.replace(/\s*\n\s*/g, '') +
  '</g></svg>';

const thin = (s) => `<g stroke-width="4">${s}</g>`;

const pt2 = (cx, cy, rx, ry, deg) => {
  const a = (deg * Math.PI) / 180;
  return [f(cx + rx * Math.cos(a)), f(cy + ry * Math.sin(a))];
};
const pt = (cx, cy, r, deg) => pt2(cx, cy, r, r, deg);

// 둥근 꽃잎/구름 테두리: 타원 위 n개 점을 바깥으로 볼록한 호로 잇는다.
function scallopD(cx, cy, rx, ry, n, k = 0.6, start = -90) {
  const p = [];
  for (let i = 0; i < n; i++) p.push(pt2(cx, cy, rx, ry, start + (360 * i) / n));
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i <= n; i++) {
    const a = p[i - 1];
    const b = p[i % n];
    const r = f(Math.hypot(b[0] - a[0], b[1] - a[1]) * k);
    d += `A${r} ${r} 0 0 1 ${b[0]} ${b[1]}`;
  }
  return d + 'Z';
}

// 윗면만 몽글몽글하고 아랫면은 완만한 구름
function cloudD(cx, cy, rx, ry, n = 5, k = 0.62) {
  let d = '';
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const q = pt2(cx, cy, rx, ry, 180 + (180 * i) / n);
    if (!prev) d = `M${q[0]} ${q[1]}`;
    else {
      const r = f(Math.hypot(q[0] - prev[0], q[1] - prev[1]) * k);
      d += `A${r} ${r} 0 0 1 ${q[0]} ${q[1]}`;
    }
    prev = q;
  }
  return `${d}Q${f(cx)} ${f(cy + ry * 0.6)} ${f(cx - rx)} ${f(cy)}Z`;
}
const cloud = (cx, cy, rx, ry, n = 5) => `<path d="${cloudD(cx, cy, rx, ry, n)}"${W}/>`;

function raysD(cx, cy, r1, r2, n, off = 0) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = pt(cx, cy, r1, off + (360 * i) / n);
    const b = pt(cx, cy, r2, off + (360 * i) / n);
    d += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  }
  return d;
}
// 작은 배경용 해 (선 햇살)
const sun = (cx, cy, r, n = 8) =>
  `<path d="${raysD(cx, cy, r + 12, r + 28, n, n % 2 ? -90 : 0)}"/><circle cx="${cx}" cy="${cy}" r="${r}"${W}/>`;

// 세모 햇살 (칠할 수 있는 닫힌 도형)
function rayTris(cx, cy, r1, r2, n, half, off = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = off + (360 * i) / n;
    const p = [pt(cx, cy, r1, a - half), pt(cx, cy, r2, a), pt(cx, cy, r1, a + half)];
    s += `<polygon points="${p.map((q) => q.join(',')).join(' ')}"${W}/>`;
  }
  return s;
}

function starPts(cx, cy, R, inner = 0.48) {
  const p = [];
  for (let i = 0; i < 10; i++) p.push(pt(cx, cy, i % 2 ? R * inner : R, -90 + i * 36).join(','));
  return p.join(' ');
}
const star = (cx, cy, R) => `<polygon points="${starPts(cx, cy, R)}"/>`;

const tuftD = (x, y) =>
  `M${x - 14} ${y - 12}Q${x - 4} ${y - 8} ${x} ${y}Q${x - 2} ${y - 13} ${x + 3} ${y - 22}` +
  `M${x} ${y}Q${x + 5} ${y - 9} ${x + 14} ${y - 13}`;
const tufts = (y, xs) => thin(`<path d="${xs.map((x) => tuftD(x, y)).join('')}"/>`);

const heartD = (x, y, s) =>
  `M${x} ${f(y + s * 0.9)}C${f(x - s * 1.6)} ${f(y - s * 0.1)} ${f(x - s * 0.7)} ${f(y - s * 1.1)} ${x} ${f(y - s * 0.35)}` +
  `C${f(x + s * 0.7)} ${f(y - s * 1.1)} ${f(x + s * 1.6)} ${f(y - s * 0.1)} ${x} ${f(y + s * 0.9)}Z`;
const heart = (x, y, s, attrs = '') => `<path d="${heartD(x, y, s)}"${attrs}/>`;

const sparkleD = (x, y, r) => {
  const c = r * 0.2;
  return (
    `M${x} ${y - r}Q${f(x + c)} ${f(y - c)} ${x + r} ${y}Q${f(x + c)} ${f(y + c)} ${x} ${y + r}` +
    `Q${f(x - c)} ${f(y + c)} ${x - r} ${y}Q${f(x - c)} ${f(y - c)} ${x} ${y - r}Z`
  );
};
const sparkle = (x, y, r) => `<path d="${sparkleD(x, y, r)}"/>`;

// 까만 눈 + 하얀 반짝이
const eye = (cx, cy, rx, ry) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${D} stroke-width="4"/>` +
  `<circle cx="${f(cx + rx * 0.3)}" cy="${f(cy - ry * 0.35)}" r="${f(Math.max(3, rx * 0.33))}" fill="white" stroke="none"/>`;

// 꼭지와 잎이 달린 사과
const apple = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}"${W}/>` +
  thin(
    `<path d="M${x} ${y - r}Q${f(x + r * 0.1)} ${f(y - r * 1.4)} ${f(x + r * 0.35)} ${f(y - r * 1.55)}"/>` +
      `<path d="M${f(x + r * 0.15)} ${f(y - r * 1.25)}C${f(x + r * 0.5)} ${f(y - r * 1.8)} ${f(x + r * 1.1)} ${f(y - r * 1.7)} ${f(x + r * 1.15)} ${f(y - r * 1.4)}C${f(x + r * 0.8)} ${f(y - r * 1.1)} ${f(x + r * 0.4)} ${f(y - r * 1.1)} ${f(x + r * 0.15)} ${f(y - r * 1.25)}Z"/>`,
  );

const daisy = (cx, cy, r, n = 8) =>
  `<path d="${scallopD(cx, cy, r, r, n, 0.55)}"${W}/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.4)}"${W}/>`;

// 오른쪽(xR)에서 왼쪽(xL)으로 크림이 흘러내린 모양
function dripsD(xR, xL, y, n, deep, shallow) {
  const w = (xR - xL) / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const x0 = f(xR - i * w);
    const x1 = f(xR - (i + 1) * w);
    const h = f(y + (i % 2 ? shallow : deep));
    d += `C${x0} ${h} ${x1} ${h} ${x1} ${f(y)}`;
  }
  return d;
}

const boneD = (x, y) =>
  `M${x - 25} ${y - 8}H${x + 25}C${x + 21} ${y - 28} ${x + 57} ${y - 24} ${x + 41} ${y}` +
  `C${x + 57} ${y + 24} ${x + 21} ${y + 28} ${x + 25} ${y + 8}H${x - 25}` +
  `C${x - 21} ${y + 28} ${x - 57} ${y + 24} ${x - 41} ${y}C${x - 57} ${y - 24} ${x - 21} ${y - 28} ${x - 25} ${y - 8}Z`;

// 절대좌표(M/L/C/Q/Z) 경로를 중심점 기준으로 n번 돌려 하나의 경로로 잇는다.
function spin(d, n, off = 0, cx = 400, cy = 300) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = ((off + (360 * i) / n) * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let buf = [];
    let sep = false;
    for (const t of tok) {
      if (/[A-Z]/.test(t)) {
        out += t;
        sep = false;
        continue;
      }
      buf.push(+t);
      if (buf.length === 2) {
        const dx = buf[0] - cx;
        const dy = buf[1] - cy;
        out += `${sep ? ' ' : ''}${f(cx + dx * c - dy * s)} ${f(cy + dx * s + dy * c)}`;
        sep = true;
        buf = [];
      }
    }
  }
  return out;
}

// 원을 중심 둘레에 고르게 배치 (각도 0 = 위쪽)
const circlesAround = (n, off, dist, r, cx = 400, cy = 300) =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = pt(cx, cy, dist, -90 + off + (360 * i) / n);
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');

// ---------------------------------------------------------------------------
// 도안
// ---------------------------------------------------------------------------

const CAT = svg(`
<path d="M0 530H800"/>
${tufts(530, [40, 610, 700, 765])}
${heart(612, 178, 18)}${heart(668, 126, 12)}
<circle cx="160" cy="482" r="48"${W}/>
${thin(`<path d="M120 455Q160 446 202 466M113 484Q160 474 207 494M126 515Q164 500 196 520M152 435Q134 482 160 529"/><path d="M207 504C232 520 248 492 266 514"/>`)}
<path d="M500 506C592 516 652 448 626 380C616 352 582 352 588 380C608 440 576 480 504 478Z"${W}/>
<path d="M335 300C262 370 262 522 330 530H470C538 522 538 370 465 300Z"${W}/>
${thin(`<ellipse cx="400" cy="440" rx="52" ry="68"/>`)}
<path d="M298 200L305 92L375 145Z"${W}/>
<path d="M502 200L495 92L425 145Z"${W}/>
${thin(`<path d="M316 178L320 120L357 148Z"/><path d="M484 178L480 120L443 148Z"/>`)}
<ellipse cx="400" cy="232" rx="122" ry="96"${W}/>
${eye(355, 225, 13, 17)}${eye(445, 225, 13, 17)}
<path d="M389 258H411L400 270Z"${D} stroke-width="4"/>
${thin(`<path d="M400 270Q400 284 386 284M400 270Q400 284 414 284M326 254L272 245M326 268L270 274M474 254L528 245M474 268L530 274"/>`)}
<ellipse cx="360" cy="520" rx="33" ry="17"${W}/>
<ellipse cx="440" cy="520" rx="33" ry="17"${W}/>
${thin(`<path d="M350 506V515M370 506V515M430 506V515M450 506V515"/>`)}
`);

const DOG = svg(`
<path d="M0 530H800"/>
${tufts(530, [40, 268, 610, 730])}
${sun(680, 100, 36)}
${cloud(140, 112, 80, 36)}
<path d="${boneD(172, 509)}"${W}/>
<path d="M505 470C565 465 600 425 610 380C614 362 594 356 588 374C576 410 550 432 500 440Z"${W}/>
${thin(`<path d="M634 352Q650 372 644 396M656 334Q676 364 666 398"/>`)}
<path d="M335 300C270 370 268 520 322 530H478C532 520 530 370 465 300Z"${W}/>
${thin(`<ellipse cx="400" cy="460" rx="50" ry="50"/>`)}
<path d="M318 296Q400 346 482 296L488 326Q400 384 312 326Z"${W}/>
<circle cx="400" cy="372" r="16"${W}/>
<ellipse cx="400" cy="222" rx="118" ry="100"${W}/>
<path d="M310 140C255 132 228 222 244 300C254 348 306 342 312 296C316 246 322 190 310 140Z"${W}/>
<path d="M490 140C545 132 572 222 556 300C546 348 494 342 488 296C484 246 478 190 490 140Z"${W}/>
${thin(`<ellipse cx="440" cy="203" rx="27" ry="27"/>`)}
${eye(360, 205, 12, 15)}${eye(440, 205, 12, 15)}
${thin(`<ellipse cx="400" cy="266" rx="54" ry="38"/>`)}
<path d="M389 284C386 318 414 318 411 284Z"${W} stroke-width="4"/>
<ellipse cx="400" cy="248" rx="17" ry="11"${D}/>
${thin(`<path d="M400 259V276M400 276Q388 290 374 280M400 276Q412 290 426 280M400 290V302"/>`)}
<ellipse cx="360" cy="522" rx="34" ry="17"${W}/>
<ellipse cx="440" cy="522" rx="34" ry="17"${W}/>
${thin(`<path d="M350 507V516M370 507V516M430 507V516M450 507V516"/>`)}
`);

const RABBIT = svg(`
<path d="M0 532H800"/>
${tufts(532, [40, 262, 740])}
${cloud(130, 100, 75, 34)}
${sun(680, 95, 34)}
<path d="M110 472V532M200 504V532"/>
${thin(`<path d="M110 512C92 492 72 494 64 502C76 516 96 520 110 512Z"/>`)}
${daisy(110, 440, 32)}${daisy(200, 484, 22, 7)}
<ellipse cx="345" cy="140" rx="34" ry="92" transform="rotate(-12 345 140)"${W}/>
<ellipse cx="455" cy="140" rx="34" ry="92" transform="rotate(12 455 140)"${W}/>
${thin(`<ellipse cx="345" cy="150" rx="16" ry="64" transform="rotate(-12 345 140)"/><ellipse cx="455" cy="150" rx="16" ry="64" transform="rotate(12 455 140)"/>`)}
<path d="M325 335C262 400 268 522 322 532H478C532 522 538 400 475 335Z"${W}/>
${thin(`<ellipse cx="400" cy="452" rx="56" ry="62"/>`)}
<ellipse cx="400" cy="262" rx="108" ry="92"${W}/>
<ellipse cx="366" cy="388" rx="22" ry="15"${W}/>
<ellipse cx="434" cy="388" rx="22" ry="15"${W}/>
${eye(362, 252, 11, 14)}${eye(438, 252, 11, 14)}
${thin(`<ellipse cx="333" cy="292" rx="18" ry="11"/><ellipse cx="467" cy="292" rx="18" ry="11"/>`)}
${thin(`<path d="M400 292V302M400 302Q390 313 379 305M400 302Q410 313 421 305"/>`)}
<path d="M392 304H408V318Q400 322 392 318Z"${W} stroke-width="4"/>
${thin(`<path d="M400 304V319"/>`)}
<path d="M390 280Q400 273 410 280Q405 291 400 292Q395 291 390 280Z"${D} stroke-width="4"/>
<ellipse cx="350" cy="528" rx="46" ry="18"${W}/>
<ellipse cx="450" cy="528" rx="46" ry="18"${W}/>
${thin(`<path d="M338 513V522M356 512V521M444 512V521M462 513V522"/>`)}
<g transform="translate(588 507)">
<g stroke-width="5">
<ellipse cx="-30" cy="-5" rx="30" ry="12" transform="rotate(190 -30 -5)"${W}/>
<ellipse cx="-12" cy="-28" rx="30" ry="12" transform="rotate(250 -12 -28)"${W}/>
<ellipse cx="-24" cy="-19" rx="30" ry="12" transform="rotate(220 -24 -19)"${W}/>
</g>
<path d="M0 -25Q62 -18 124 0Q62 18 0 25Q-9 0 0 -25Z"${W}/>
${thin(`<path d="M28 -12L38 -6M52 9L63 4M82 -3L91 0"/>`)}
</g>
`);

const FISH = svg(`
<path d="M0 48Q50 33 100 48T200 48T300 48T400 48T500 48T600 48T700 48T800 48"/>
<path d="M48 548C30 500 78 470 58 420C44 385 60 355 80 340C96 368 86 392 98 418C118 462 82 498 104 548Z"${W}/>
<path d="M100 548C92 515 128 495 116 462C110 445 118 430 130 422C142 440 136 456 144 470C156 500 132 520 140 548Z"${W}/>
<path d="M690 548C672 505 716 478 698 436C688 410 698 388 716 380C734 402 724 426 736 448C758 488 724 512 744 548Z"${W}/>
<path d="M742 548C736 520 766 500 756 474C752 462 758 452 768 446C778 460 774 474 780 486C790 510 772 528 778 548Z"${W}/>
<path d="M-10 540Q100 525 200 540T400 540T600 540T800 540L810 610H-10Z"${W}/>
${thin(`<ellipse cx="300" cy="572" rx="22" ry="11"/><ellipse cx="520" cy="575" rx="26" ry="12"/><ellipse cx="180" cy="578" rx="16" ry="9"/>`)}
<polygon points="${starPts(625, 572, 22, 0.5)}" stroke-width="5"/>
${thin(`<circle cx="105" cy="232" r="15"/><circle cx="78" cy="178" r="11"/><circle cx="106" cy="128" r="8"/><circle cx="640" cy="110" r="10"/><circle cx="610" cy="86" r="6"/>`)}
<g stroke-width="5">
<path d="M712 150L742 130V170Z"${W}/>
<ellipse cx="695" cy="150" rx="30" ry="18"${W}/>
<circle cx="680" cy="146" r="3.5"${D} stroke="none"/>
</g>
<g transform="translate(-40 -30) scale(1.1)">
<path d="M520 300L640 205Q615 300 640 395Z"${W}/>
<path d="M300 232Q330 140 432 132Q408 185 482 262Z"${W}/>
<path d="M340 365Q352 440 428 452Q412 410 458 352Z"${W}/>
<path d="M165 300C205 185 430 165 548 300C430 435 205 415 165 300Z"${W}/>
<path d="M292 209.8Q326 300 292 390.2M400 213.2Q432 300 400 386.8M470 238.8Q496 300 470 361.2"/>
<path d="M330 300C365 290 395 315 385 345C360 348 338 330 330 300Z"${W} stroke-width="5"/>
<circle cx="240" cy="280" r="22"${W} stroke-width="5"/>
<circle cx="236" cy="283" r="10"${D} stroke="none"/>
<circle cx="232" cy="278" r="3.5" fill="white" stroke="none"/>
${thin(`<path d="M178 318Q192 326 205 316M590 260L615 255M590 300H618M590 340L615 345"/>`)}
</g>
`);

const BUTTERFLY = svg(`
<path d="M0 555Q200 540 400 555T800 555"/>
<path d="M110 552V500M690 552V500"/>
${daisy(110, 474, 28)}${daisy(690, 474, 28)}
${tufts(555, [200, 300, 500, 600])}
${thin(`${sparkle(70, 70, 18)}${sparkle(730, 70, 18)}${sparkle(80, 300, 13)}${sparkle(720, 300, 13)}`)}
<path d="M392 300C285 295 170 350 198 438C225 515 340 478 392 335Z"${W}/>
<path d="M408 300C515 295 630 350 602 438C575 515 460 478 408 335Z"${W}/>
<path d="M392 255C330 120 160 70 128 165C105 245 215 305 392 292Z"${W}/>
<path d="M408 255C470 120 640 70 672 165C695 245 585 305 408 292Z"${W}/>
<g stroke-width="5">
<circle cx="232" cy="180" r="42"/><circle cx="568" cy="180" r="42"/>
<circle cx="320" cy="250" r="16"/><circle cx="480" cy="250" r="16"/>
<circle cx="272" cy="415" r="30"/><circle cx="528" cy="415" r="30"/>
<circle cx="335" cy="372" r="12"/><circle cx="465" cy="372" r="12"/>
</g>
${thin(`<circle cx="232" cy="180" r="18"/><circle cx="568" cy="180" r="18"/>`)}
<ellipse cx="400" cy="305" rx="20" ry="112"${W}/>
${thin(`<path d="M381 270H419M380 305H420M381 340H419M384.4 375H415.6"/>`)}
<path d="M388 150C375 115 355 95 340 85M412 150C425 115 445 95 460 85"/>
<circle cx="337" cy="82" r="9"${W}/><circle cx="463" cy="82" r="9"${W}/>
<circle cx="400" cy="178" r="32"${W}/>
<circle cx="389" cy="174" r="5"${D} stroke="none"/><circle cx="411" cy="174" r="5"${D} stroke="none"/>
${thin(`<path d="M389 189Q400 198 411 189"/>`)}
`);

const DINO = svg(`
<path d="M0 535H800"/>
${tufts(535, [30, 160, 580, 770])}
${sun(110, 100, 40)}
${cloud(330, 92, 70, 32)}
<path d="M300 430C298 475 298 505 296 520Q296 528 304 528H346Q354 528 353 520C351 495 352 470 356 440Z"${W}/>
<path d="M455 425C455 470 455 500 453 520Q453 528 461 528H503Q511 528 510 520C508 495 507 465 505 425Z"${W}/>
<path d="M245 425C242 470 240 505 238 527Q238 535 247 535H297Q306 535 305 527C303 500 304 470 310 435Z"${W}/>
<path d="M420 430C418 475 417 505 415 527Q415 535 424 535H474Q483 535 482 527C480 500 482 470 488 425Z"${W}/>
<polygon points="395,275 425,205 455,292"${W}/>
<polygon points="335,262 362,190 392,262"${W}/>
<polygon points="270,270 295,200 322,262"${W}/>
<polygon points="175,358 159,309 201,340"${W}/>
<polygon points="130,388 121,349 151,376"${W}/>
<path d="M470 300C430 245 300 230 240 290C200 330 140 380 60 420C50 425 52 438 65 436C140 430 200 420 230 440C250 470 300 470 330 465C400 470 470 465 510 430C535 400 540 360 530 330C545 270 560 220 590 205C640 210 680 195 678 160C675 125 630 115 600 125C560 135 540 170 520 205C500 240 485 270 470 300Z"${W}/>
${thin(`<circle cx="330" cy="330" r="20"/><circle cx="415" cy="322" r="14"/><circle cx="275" cy="385" r="14"/><circle cx="445" cy="392" r="18"/><circle cx="362" cy="408" r="12"/>`)}
${thin(`<path d="M246 535Q253 522 260 535M264 535Q271 522 278 535M282 535Q289 522 296 535M423 535Q430 522 437 535M441 535Q448 522 455 535M459 535Q466 522 473 535"/>`)}
${eye(612, 150, 9, 11)}
<circle cx="663" cy="150" r="3"${D} stroke="none"/>
${thin(`<path d="M632 182Q650 189 667 174"/><circle cx="616" cy="182" r="9"/>`)}
<ellipse cx="665" cy="504" rx="24" ry="31"${W}/>
<ellipse cx="712" cy="509" rx="21" ry="26"${W}/>
${thin(`<path d="M641.5 497L653 507L665 494L677 507L688.5 497"/>`)}
`);

const OWL = svg(`
<path d="M674.9 53.3A52 52 0 1 0 726.2 128.8A46 46 0 0 1 674.9 53.3Z"/>
${thin(`${star(120, 100, 22)}${star(230, 60, 14)}${star(560, 70, 16)}${star(95, 300, 16)}${star(705, 300, 20)}`)}
<path d="M640 490C650 455 690 445 705 455C695 480 665 492 640 490Z"${W}/>
<path d="M600 518C615 548 650 558 668 548C655 528 630 518 600 518Z"${W}/>
<path d="M298 200L285 110L352 160Z"${W}/>
<path d="M502 200L515 110L448 160Z"${W}/>
<path d="M400 140C525 140 565 285 548 385C535 470 472 502 400 502C328 502 265 470 252 385C235 285 275 140 400 140Z"${W}/>
<path d="M400 218C362 168 268 178 278 268C288 340 368 345 400 312C432 345 512 340 522 268C532 178 438 168 400 218Z" stroke-width="5"/>
<circle cx="345" cy="262" r="42"${W}/>
<circle cx="455" cy="262" r="42"${W}/>
<circle cx="350" cy="266" r="18"${D} stroke="none"/><circle cx="450" cy="266" r="18"${D} stroke="none"/>
<circle cx="357" cy="258" r="6" fill="white" stroke="none"/><circle cx="457" cy="258" r="6" fill="white" stroke="none"/>
<path d="M400 292L384 312L400 342L416 312Z"${W}/>
<ellipse cx="400" cy="425" rx="92" ry="66" stroke-width="5"/>
${thin(`<path d="M365 395Q375 408 385 395M415 395Q425 408 435 395M340 425Q350 438 360 425M390 425Q400 438 410 425M440 425Q450 438 460 425M365 455Q375 468 385 455M415 455Q425 468 435 455"/>`)}
<path d="M262 300C215 345 218 440 285 475C298 420 296 355 262 300Z"${W}/>
<path d="M538 300C585 345 582 440 515 475C502 420 504 355 538 300Z"${W}/>
${thin(`<path d="M248 370Q262 385 282 380M250 415Q266 428 286 422M552 370Q538 385 518 380M550 415Q534 428 514 422"/>`)}
<path d="M-10 492C200 485 500 500 715 488C742 487 745 520 718 522C500 532 200 524 -10 526Z"${W}/>
${thin(`<path d="M120 505Q160 500 200 506M460 510Q520 508 580 504"/>`)}
<ellipse cx="365" cy="494" rx="26" ry="13"${W}/>
<ellipse cx="435" cy="494" rx="26" ry="13"${W}/>
${thin(`<path d="M357 506V496M373 506V496M427 506V496M443 506V496"/>`)}
`);

const HOUSE = svg(`
<path d="M0 530H800"/>
<path d="M362 530C350 560 335 580 325 600M438 530C450 560 465 580 475 600"/>
${sun(95, 90, 36)}
${cloud(700, 118, 72, 32)}
${thin(`<circle cx="505" cy="122" r="13"/><circle cx="528" cy="94" r="17"/><circle cx="560" cy="64" r="21"/>`)}
<rect x="105" y="420" width="30" height="110"${W}/>
<path d="${scallopD(120, 360, 66, 58, 9, 0.62)}"${W}/>
${thin(`<circle cx="98" cy="350" r="9"/><circle cx="140" cy="335" r="9"/><circle cx="125" cy="385" r="9"/>`)}
<path d="M615 478H810M615 508H810"/>
<path d="M600 530V460L615 445L630 460V530Z"${W}/>
<path d="M660 530V460L675 445L690 460V530Z"${W}/>
<path d="M720 530V460L735 445L750 460V530Z"${W}/>
<path d="M780 530V460L795 445L810 460V530Z"${W}/>
<rect x="470" y="160" width="46" height="90"${W}/>
<rect x="462" y="146" width="62" height="18" rx="4"${W}/>
<rect x="230" y="280" width="340" height="250"${W}/>
<polygon points="195,295 400,128 605,295"${W}/>
<circle cx="400" cy="218" r="28"/>
${thin(`<path d="M372 218H428M400 190V246"/>`)}
<path d="M362 530V445A38 38 0 0 1 438 445V530"/>
<circle cx="424" cy="488" r="5"${D}/>
<rect x="262" y="345" width="82" height="72" rx="4"/>
<rect x="456" y="345" width="82" height="72" rx="4"/>
${thin(`<path d="M303 345V417M262 381H344M497 345V417M456 381H538"/>`)}
<rect x="256" y="417" width="94" height="18" rx="5"${W}/>
<rect x="450" y="417" width="94" height="18" rx="5"${W}/>
${tufts(530, [40, 190])}
`);

const TREE = svg(`
<path d="M0 540H800"/>
${sun(80, 78, 32)}
${cloud(705, 82, 62, 28)}
<path d="M318 540C356 520 366 470 366 360H434C434 470 444 520 482 540Z"${W}/>
${thin(`<ellipse cx="400" cy="458" rx="15" ry="21"/><path d="M380 400Q392 410 388 425M420 495Q410 505 414 520"/>`)}
<path d="M522 330V472M588 330V472"/>
<rect x="505" y="468" width="100" height="16" rx="6"${W}/>
<path d="${scallopD(400, 225, 255, 158, 14, 0.62)}"${W}/>
${[
  [270, 175],
  [400, 128],
  [530, 170],
  [325, 280],
  [462, 250],
  [585, 270],
  [205, 280],
]
  .map(([x, y]) => apple(x, y, 23))
  .join('')}
${apple(232, 520, 18)}${apple(274, 523, 15)}
${tufts(540, [60, 150, 680, 750])}
`);

const FLOWERPOT = svg(`
<path d="M0 552H800"/>
<path d="M400 410C395 330 405 280 400 230M366 410C340 350 270 335 232 310M434 410C460 350 530 320 575 304"/>
<path d="M398 340C370 315 335 320 322 335C345 352 375 355 398 340Z"${W}/>
<path d="M402 298C430 273 465 278 478 293C455 310 425 313 402 298Z"${W}/>
<path d="M303 347C285 368 255 371 240 362C252 342 280 336 303 347Z"${W}/>
<path d="M497 341C515 362 545 366 560 357C547 338 520 332 497 341Z"${W}/>
${thin(`<path d="M394 338Q360 332 332 335M406 296Q440 290 468 293"/>`)}
<path d="M186 222L207 246L228 210L249 246L270 222V270C270 298 251 314 228 314C205 314 186 298 186 270Z"${W}/>
${daisy(582, 256, 46)}
<path d="${scallopD(400, 172, 80, 80, 8, 0.55, -67.5)}"${W}/>
<path d="${raysD(400, 172, 34, 80, 8, -67.5)}" stroke-width="5"/>
<circle cx="400" cy="172" r="34"${W}/>
<circle cx="388" cy="166" r="4"${D} stroke="none"/><circle cx="412" cy="166" r="4"${D} stroke="none"/>
${thin(`<path d="M387 180Q400 191 413 180"/>`)}
<path d="M308 439H492L466 552H334Z"${W}/>
<rect x="290" y="395" width="220" height="44" rx="10"${W}/>
${heart(400, 495, 24)}
${thin(`<ellipse cx="108" cy="118" rx="22" ry="16" transform="rotate(-25 108 118)"${W}/><ellipse cx="152" cy="118" rx="22" ry="16" transform="rotate(25 152 118)"${W}/><ellipse cx="112" cy="146" rx="15" ry="11" transform="rotate(25 112 146)"${W}/><ellipse cx="148" cy="146" rx="15" ry="11" transform="rotate(-25 148 146)"${W}/><ellipse cx="130" cy="132" rx="6" ry="22"${W}/><path d="M127 112Q120 96 112 92M133 112Q140 96 148 92"/>`)}
${thin(`${sparkle(660, 110, 18)}${sparkle(710, 190, 13)}${sparkle(90, 300, 14)}${sparkle(700, 400, 15)}`)}
`);

const WEATHER = svg(`
<path d="M0 560Q200 520 400 560T800 560"/>
${[330, 292, 254, 216, 178, 140].map((r) => `<path d="M${400 - r} 525A${r} ${r} 0 0 1 ${400 + r} 525"/>`).join('')}
${cloud(165, 520, 128, 54, 5)}
${cloud(635, 520, 128, 54, 5)}
${rayTris(130, 125, 48, 88, 8, 15, -90)}
<circle cx="130" cy="125" r="54"${W}/>
${eye(112, 115, 6, 8)}${eye(148, 115, 6, 8)}
${thin(`<path d="M110 138Q130 156 150 138"/><circle cx="98" cy="137" r="9"/><circle cx="162" cy="137" r="9"/>`)}
${cloud(645, 110, 95, 45, 5)}
${[
  [595, 188],
  [645, 210],
  [695, 186],
]
  .map(([x, y]) => `<path d="M${x} ${y - 16}C${x + 10} ${y - 2} ${x + 12} ${y + 12} ${x} ${y + 12}C${x - 12} ${y + 12} ${x - 10} ${y - 2} ${x} ${y - 16}Z"/>`)
  .join('')}
${thin(`<path d="M365 100Q375 88 385 100Q395 88 405 100M430 66Q438 57 446 66Q454 57 462 66"/>`)}
`);

const CAR = svg(`
<path d="M0 498H800"/>
${[40, 210, 380, 550, 720].map((x) => `<rect x="${x}" y="540" width="90" height="14" rx="7"/>`).join('')}
${sun(690, 95, 38)}
${cloud(150, 110, 75, 34)}
${cloud(340, 70, 52, 24, 4)}
${thin(`<path d="M40 330H88M24 370H82M44 410H92"/>`)}
<rect x="100" y="405" width="30" height="24" rx="10"${W}/>
<rect x="690" y="405" width="30" height="24" rx="10"${W}/>
<path d="M115 430V365Q115 335 145 330L255 318L325 232Q333 222 348 222H528Q545 222 557 236L632 318L672 326Q705 334 705 368V430Q705 446 689 446H131Q115 446 115 430Z"${W}/>
<path d="M334 245H422V308H282Z"/>
<path d="M446 245H530L588 308H446Z"/>
<path d="M255 318H632M434 222V446"/>
${thin(`<rect x="395" y="334" width="26" height="9" rx="4"/><rect x="470" y="334" width="26" height="9" rx="4"/><circle cx="680" cy="356" r="13"/><rect x="124" y="358" width="16" height="26" rx="5"/>`)}
<circle cx="245" cy="444" r="54"${W}/>
<circle cx="585" cy="444" r="54"${W}/>
<circle cx="245" cy="444" r="22" stroke-width="5"/>
<circle cx="585" cy="444" r="22" stroke-width="5"/>
<circle cx="245" cy="444" r="5"${D}/><circle cx="585" cy="444" r="5"${D}/>
`);

const ROCKET = svg(`
${thin(`${star(95, 330, 18)}${star(250, 430, 14)}${star(580, 250, 16)}${star(705, 330, 18)}${star(150, 510, 16)}${star(300, 60, 12)}${star(540, 58, 13)}`)}
${thin(`<circle cx="235" cy="290" r="5"/><circle cx="610" cy="180" r="5"/><circle cx="560" cy="520" r="5"/><circle cx="740" cy="230" r="5"/>`)}
<g transform="rotate(-18 165 175)">
<ellipse cx="165" cy="175" rx="108" ry="28"/>
<ellipse cx="165" cy="175" rx="84" ry="16"/>
</g>
<circle cx="165" cy="175" r="58"${W}/>
${thin(`<path d="M112.7 150Q165 162 217.3 150"/>`)}
<g transform="rotate(-18 165 175)">
<path d="M57 175A108 28 0 0 0 273 175H249A84 16 0 0 1 81 175Z"${W}/>
</g>
<circle cx="660" cy="120" r="45"${W}/>
${thin(`<circle cx="645" cy="105" r="10"/><circle cx="675" cy="138" r="8"/><circle cx="672" cy="98" r="5"/>`)}
<circle cx="665" cy="470" r="34"${W}/>
${thin(`<path d="M634 457Q665 468 696 457M633 482Q665 492 697 482"/>`)}
<path d="M330 330C285 350 262 395 268 460L332 412Z"${W}/>
<path d="M470 330C515 350 538 395 532 460L468 412Z"${W}/>
<path d="M345 436C335 485 375 505 400 562C425 505 465 485 455 436Z"${W}/>
${thin(`<path d="M372 438C370 470 392 485 400 520C408 485 430 470 428 438Z"/>`)}
<path d="M325 420V215C325 145 368 98 400 62C432 98 475 145 475 215V420Z"${W}/>
<path d="M325 215Q400 238 475 215M325 362H475"/>
<path d="M350 420H450L462 448H338Z"${W}/>
<circle cx="400" cy="282" r="40"${W}/>
${thin(`<circle cx="400" cy="282" r="28"/><path d="M382 270Q388 260 398 258"/><circle cx="348" cy="391" r="6"/><circle cx="380" cy="391" r="6"/><circle cx="420" cy="391" r="6"/><circle cx="452" cy="391" r="6"/>`)}
`);

const SAILBOAT = svg(`
<path d="M0 456Q50 436 100 456T200 456T300 456T400 456T500 456T600 456T700 456T800 456"/>
${sun(105, 95, 40)}
${cloud(690, 82, 70, 30)}
${thin(`<path d="M520 120Q532 108 544 120Q556 108 568 120M600 160Q610 150 620 160Q630 150 640 160"/>`)}
<path d="M400 395V85"/>
<path d="M400 85L458 100L400 115Z"${W}/>
<path d="M412 110Q525 235 600 380H412Z"${W}/>
<path d="M388 135Q300 255 215 380H388Z"${W}/>
${thin(`<path d="M412 250H522.5M284 280H388"/>`)}
<path d="M165 395H635L570 482Q562 492 548 492H252Q238 492 230 482Z"${W}/>
<path d="M183.7 420H616.3"/>
<g stroke-width="5"><circle cx="320" cy="452" r="15"/><circle cx="400" cy="452" r="15"/><circle cx="480" cy="452" r="15"/></g>
${thin(`<path d="M90 520Q105 508 120 520M300 560Q318 546 336 560M620 530Q640 515 660 530M470 575Q488 562 506 575M720 580Q735 568 750 580"/>`)}
<g stroke-width="5">
<path d="M190 562L165 545V579Z"${W}/>
<ellipse cx="140" cy="562" rx="30" ry="17"${W}/>
<circle cx="128" cy="558" r="3.5"${D} stroke="none"/>
</g>
`);

const flagY = (x) => 35 + 160 * (x / 800) * (1 - x / 800);
const CAKE = svg(`
<path d="M0 35Q400 115 800 35"/>
${[55, 140, 225, 575, 660, 745]
  .map(
    (x) =>
      `<polygon points="${x - 30},${f(flagY(x - 30))} ${x + 30},${f(flagY(x + 30))} ${x},${f(flagY(x) + 50)}"${W}/>`,
  )
  .join('')}
${thin(`${sparkle(95, 210, 18)}${sparkle(705, 210, 18)}${sparkle(80, 360, 12)}${sparkle(720, 360, 12)}<circle cx="160" cy="300" r="5"/><circle cx="640" cy="300" r="5"/><circle cx="190" cy="150" r="5"/><circle cx="610" cy="150" r="5"/>`)}
<ellipse cx="400" cy="535" rx="265" ry="28"${W}/>
<path d="M185 395V512Q400 540 615 512V395Z"${W}/>
<path d="M178 380H622V408${dripsD(622, 178, 408, 8, 34, 10)}Z"${W}/>
<path d="M270 380V265H530V380Z"${W}/>
${[
  [330, 170, 82],
  [389, 155, 97],
  [448, 170, 82],
]
  .map(
    ([x, y, h]) =>
      `<rect x="${x}" y="${y}" width="22" height="${h}" rx="4"${W}/>` +
      thin(`<path d="M${x} ${y + 22}L${x + 22} ${y + 12}M${x} ${y + 44}L${x + 22} ${y + 34}M${x} ${y + 66}L${x + 22} ${y + 56}"/>`) +
      thin(`<path d="M${x + 11} ${y}V${y - 6}"/>`) +
      `<path d="M${x + 11} ${y - 6}C${x - 2} ${y - 11} ${x - 4} ${y - 26} ${x + 11} ${y - 50}C${x + 26} ${y - 26} ${x + 24} ${y - 11} ${x + 11} ${y - 6}Z"${W}/>`,
  )
  .join('')}
<path d="M262 250H538V274${dripsD(538, 262, 274, 6, 30, 10)}Z"${W}/>
${heart(400, 338, 24)}
${[245, 322, 400, 478, 555].map((x) => `<circle cx="${x}" cy="472" r="14" stroke-width="5"/>`).join('')}
`);

const ICECREAM = svg(`
${thin(`${sparkle(150, 135, 20)}${sparkle(712, 120, 16)}${sparkle(62, 520, 14)}${sparkle(742, 535, 14)}<circle cx="262" cy="62" r="5"/><circle cx="545" cy="60" r="5"/><circle cx="66" cy="320" r="5"/><circle cx="738" cy="345" r="5"/>`)}
${heart(232, 540, 18)}${heart(575, 535, 18)}
<g transform="rotate(-8 155 330)">
<rect x="141" y="372" width="28" height="74" rx="12"${W}/>
<path d="M108 375V265A47 47 0 0 1 202 265V375Q202 388 189 388H121Q108 388 108 375Z"${W}/>
<path d="M108 300H202M108 340H202"/>
</g>
<rect x="642" y="296" width="16" height="164" rx="6"${W}/>
<path d="M650 330L620 314V346ZM650 330L680 314V346Z"${W} stroke-width="5"/>
<circle cx="650" cy="330" r="7"${W} stroke-width="5"/>
<circle cx="650" cy="245" r="60"${W}/>
<path d="${[0, 60, 120, 180, 240, 300].map((a) => `M650 245Q${pt(650, 245, 42, a - 55).join(' ')} ${pt(650, 245, 60, a).join(' ')}`).join('')}" stroke-width="5"/>
<polygon points="295,360 505,360 400,568"${W}/>
${thin(`<path d="M347.5 360L426.3 516M400 360L452.5 464M452.5 360L478.8 412M452.5 360L373.8 516M400 360L347.5 464M347.5 360L321.3 412"/>`)}
<path d="M290.9 360A120 120 0 1 1 509.1 360${dripsD(509.1, 290.9, 360, 6, 36, 12)}Z"${W}/>
<path d="M316.3 235A95 95 0 1 1 483.7 235${dripsD(483.7, 316.3, 235, 5, 32, 12)}Z"${W}/>
${thin(`<path d="M318 300L330 292M362 280L368 292M440 282L452 286M478 318L486 330M350 335L362 340M408 312L414 324M455 345L466 338M300 340L306 352M352 160L362 152M418 135L428 142M455 180L462 192M342 205L354 210M392 178L400 168M430 212L440 206"/>`)}
<path d="M405 64Q414 42 436 34"/>
<circle cx="400" cy="85" r="22"${W}/>
<circle cx="392" cy="78" r="5" fill="white" stroke="none"/>
`);

const MANDALA = svg(`
${[
  [72, 72],
  [728, 72],
  [72, 528],
  [728, 528],
]
  .map(([x, y]) => daisy(x, y, 30, 7))
  .join('')}
<path d="${scallopD(400, 300, 232, 232, 16, 0.55)}"/>
<path d="${spin('M400 110L400 68', 16)}"/>
${thin(circlesAround(16, 11.25, 224, 11))}
<circle cx="400" cy="300" r="190"/>
<path d="${spin('M400 190C366 170 370 142 400 122C430 142 434 170 400 190Z', 8, 22.5)}"/>
<path d="${spin('M400 174C388 164 390 152 400 142C410 152 412 164 400 174Z', 8, 22.5)}" stroke-width="4"/>
<g stroke-width="5">${circlesAround(8, 0, 150, 17)}</g>
<circle cx="400" cy="300" r="110"/>
<path d="${spin('M400 266C376 244 378 218 400 202C422 218 424 244 400 266Z', 8)}"/>
<circle cx="400" cy="300" r="34"/>
<circle cx="400" cy="300" r="15" stroke-width="5"/>
`);

const CASTLE = svg(`
<path d="M0 455Q70 420 160 445"/>
<path d="M800 455Q730 420 640 445"/>
<path d="M0 530H800"/>
<path d="M352 530C340 560 320 580 300 600M448 530C470 560 490 580 510 600"/>
${thin(`${sparkle(60, 90, 18)}${sparkle(740, 90, 18)}${sparkle(275, 125, 15)}${sparkle(525, 125, 15)}<circle cx="80" cy="250" r="5"/><circle cx="720" cy="250" r="5"/>`)}
<rect x="330" y="175" width="140" height="140"${W}/>
<path d="M385 260V228A15 15 0 0 1 415 228V260Z"/>
<path d="M400 72V38"/>
<path d="M400 38L438 49L400 60Z"${W}/>
<polygon points="312,182 400,72 488,182"${W}/>
<path d="M220 530V268H250V292H275V268H305V292H330V268H360V292H385V268H415V292H440V268H470V292H495V268H525V292H550V268H580V530Z"${W}/>
<rect x="130" y="215" width="100" height="315"${W}/>
<rect x="570" y="215" width="100" height="315"${W}/>
<path d="M180 95V60M620 95V60"/>
<path d="M180 60L215 70L180 80Z"${W}/>
<path d="M620 60L655 70L620 80Z"${W}/>
<polygon points="112,222 180,95 248,222"${W}/>
<polygon points="552,222 620,95 688,222"${W}/>
<path d="M165 330V295A15 15 0 0 1 195 295V330ZM165 440V405A15 15 0 0 1 195 405V440ZM605 330V295A15 15 0 0 1 635 295V330ZM605 440V405A15 15 0 0 1 635 405V440ZM265 380V352A15 15 0 0 1 295 352V380ZM505 380V352A15 15 0 0 1 535 352V380Z"/>
<path d="M330 530V440A70 70 0 0 1 470 440V530"/>
<path d="M345 530V440A55 55 0 0 1 455 440V530"/>
${thin(`<path d="M372 392.7V530M400 385V530M428 392.7V530"/>`)}
<circle cx="388" cy="478" r="4"${D}/><circle cx="412" cy="478" r="4"${D}/>
${thin(`<rect x="240" y="440" width="36" height="18" rx="3"/><rect x="510" y="460" width="36" height="18" rx="3"/><rect x="150" y="480" width="36" height="18" rx="3"/><rect x="612" y="490" width="36" height="18" rx="3"/><rect x="290" y="320" width="36" height="18" rx="3"/><rect x="478" y="318" width="36" height="18" rx="3"/>`)}
<path d="${cloudD(62, 521, 44, 30, 4)}"${W}/>
<path d="${cloudD(738, 521, 44, 30, 4)}"${W}/>
${tufts(530, [270, 530])}
`);

// ---------------------------------------------------------------------------
// 수업 자료용 도안 (겨울·연말·교과 연계)
// ---------------------------------------------------------------------------

// 눈송이 (선만 있어 칠하는 칸을 만들지 않음)
const flakeD = (x, y, r) =>
  [90, 30, -30]
    .map((a) => {
      const p = pt(x, y, r, a);
      const q = pt(x, y, r, a + 180);
      return `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`;
    })
    .join('');
const flakes = (list) => thin(`<path d="${list.map(([x, y, r]) => flakeD(x, y, r)).join('')}"/>`);

// 오른쪽(xR)에서 왼쪽(xL)으로, 아래로 볼록한 작은 호 n개 (눈 쌓인 가장자리)
function bumpsD(xR, xL, y, n, k = 0.62) {
  const w = (xR - xL) / n;
  const r = f(w * k);
  let d = '';
  for (let i = 1; i <= n; i++) d += `A${r} ${r} 0 0 1 ${f(xR - i * w)} ${f(y)}`;
  return d;
}

// 두 원이 겹쳐 생기는 초승달
function crescentD(cx, cy, r, dx, dy, r2) {
  const d = Math.hypot(dx, dy);
  const a = (r * r - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r * r - a * a);
  const mx = cx + (a * dx) / d;
  const my = cy + (a * dy) / d;
  const p1 = [f(mx + (h * dy) / d), f(my - (h * dx) / d)];
  const p2 = [f(mx - (h * dy) / d), f(my + (h * dx) / d)];
  return `M${p1[0]} ${p1[1]}A${r} ${r} 0 1 0 ${p2[0]} ${p2[1]}A${r2} ${r2} 0 0 1 ${p1[0]} ${p1[1]}Z`;
}

// 눈 덮인 지붕 집
function snowHouse(x, base, w, h, roofH, { chimney = true, round = false, wreath = false } = {}) {
  const top = base - h;
  const cx = x + w / 2;
  const apex = top - roofH;
  const L = x - 16;
  const R = x + w + 16;
  const rb = top + 8;
  const onEdge = (frac, side) => f(cx + side * (R - cx) * frac);
  const edgeY = (frac) => f(apex + (rb - apex) * frac);
  let s = '';
  if (chimney) {
    const x0 = onEdge(0.58, 1);
    const ct = f(apex + roofH * 0.28);
    s += `<rect x="${x0}" y="${ct}" width="20" height="${f(top - ct)}"${W}/>`;
    s += `<rect x="${f(x0 - 5)}" y="${f(ct - 9)}" width="30" height="14" rx="7"${W}/>`;
  }
  s += `<rect x="${x}" y="${top}" width="${w}" height="${h}"${W}/>`;
  s += `<polygon points="${L},${rb} ${f(cx)},${apex} ${R},${rb}"${W}/>`;
  const sy = edgeY(0.4);
  s += `<path d="M${onEdge(0.4, 1)} ${sy}${bumpsD(onEdge(0.4, 1), onEdge(0.4, -1), sy, 3)}"/>`;
  if (round) s += `<circle cx="${f(cx)}" cy="${edgeY(0.74)}" r="10"/>`;
  const wy = top + 22;
  s += `<rect x="${x + 16}" y="${wy}" width="30" height="30" rx="3"/>`;
  s += thin(`<path d="M${x + 31} ${wy}V${wy + 30}M${x + 16} ${wy + 15}H${x + 46}"/>`);
  const dx = x + w - 44;
  s += `<path d="M${dx} ${base}V${base - 38}A14 14 0 0 1 ${dx + 28} ${base - 38}V${base}"/>`;
  if (wreath) s += thin(`<circle cx="${dx + 14}" cy="${base - 30}" r="8"/>`);
  return s;
}

// 눈 쌓인 전나무 (아래 칸부터 그려 위 칸이 덮음)
function snowPine(cx, base) {
  const tier = (apex, b, half, n) =>
    `<path d="M${cx} ${apex}L${cx + half} ${b}${bumpsD(cx + half, cx - half, b, n)}Z"${W}/>`;
  return (
    `<rect x="${cx - 11}" y="${base - 30}" width="22" height="42"${W}/>` +
    tier(base - 107, base - 22, 56, 4) +
    tier(base - 137, base - 62, 45, 3) +
    tier(base - 162, base - 100, 34, 3)
  );
}

const SNOW_VILLAGE = svg(`
<path d="${crescentD(700, 84, 38, 18, -14, 32)}"/>
${flakes([[60, 60, 13], [175, 128, 10], [300, 66, 12], [520, 58, 11], [610, 160, 12], [770, 236, 9], [40, 250, 10], [492, 196, 9]])}
${thin(`<circle cx="132" cy="196" r="5"/><circle cx="258" cy="208" r="5"/><circle cx="568" cy="92" r="5"/><circle cx="472" cy="128" r="5"/>`)}
<path d="M0 415C150 375 290 392 400 405S650 380 800 402"/>
${thin(`<circle cx="172" cy="262" r="8"/><circle cx="184" cy="238" r="11"/><circle cx="202" cy="210" r="14"/>`)}
${snowHouse(55, 412, 110, 80, 62, { wreath: true })}
${snowHouse(625, 410, 100, 92, 62, { chimney: false, round: true })}
<path d="M0 500Q200 488 400 496T800 492"/>
${snowPine(225, 522)}
${snowPine(578, 528)}
${thin(`<path d="M60 542Q85 530 110 542M650 552Q676 540 702 552M190 568Q215 556 240 568M540 572Q565 560 590 572"/>`)}
<path d="M352 318L290 272M448 318L510 272"/>
${thin(`<path d="M312 288.3L304 266M290 272L276 262M290 272L276 280M488 288.3L496 266M510 272L524 262M510 272L524 280"/>`)}
<circle cx="400" cy="452" r="80"${W}/>
<circle cx="400" cy="330" r="60"${W}/>
<circle cx="400" cy="226" r="48"${W}/>
<path d="M422 292L428 368L462 360L450 286Z"${W}/>
${thin(`<path d="M423.2 323.4L456.6 315.6M425.6 346.2L460.4 337.8"/>`)}
<path d="M350 258Q400 284 450 258L455 284Q400 314 345 284Z"${W}/>
<rect x="364" y="104" width="72" height="74" rx="6"${W}/>
${thin(`<path d="M364 148H436M364 164H436"/>`)}
<rect x="346" y="172" width="108" height="18" rx="8"${W}/>
${eye(382, 212, 7, 9)}${eye(418, 212, 7, 9)}
<path d="M400 220Q390 232 400 244L448 234Z"${W} stroke-width="5"/>
${[[379, 250], [389, 255], [400, 257], [411, 255], [421, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5"${D} stroke="none"/>`).join('')}
<g stroke-width="5"><circle cx="400" cy="324" r="8"/><circle cx="400" cy="354" r="8"/><circle cx="400" cy="420" r="9"/><circle cx="400" cy="456" r="9"/></g>
`);

// 크리스마스 트리
// 트리 한 칸: [꼭짓점 y, 밑변 y, 밑변 반폭, 물결 수]
const TIERS = [
  [222, 426, 172, 7],
  [156, 326, 136, 6],
  [100, 230, 96, 5],
];
const treeTier = ([apex, base, half, n]) =>
  `<path d="M400 ${apex}L${400 + half} ${base}${bumpsD(400 + half, 400 - half, base, n)}Z"${W}/>`;
// 칸 양옆 선 사이를 늘어진 띠로 잇는 장식 줄 (끝점이 옆선 위에 정확히 놓임)
const swagD = ([apex, base, half], y, sag) => {
  const dx = f((half * (y - apex)) / (base - apex));
  return `M${f(400 - dx)} ${y}Q400 ${y + 2 * sag} ${f(400 + dx)} ${y}`;
};
const garland = (tier, y, sag, gap = 15) => `<path d="${swagD(tier, y, sag)}${swagD(tier, y + gap, sag)}"/>`;
// 물결 사이 뾰족한 곳(cusp)에 매단 방울
const cuspX = ([, , half, n], k) => f(400 - half + (2 * half * k) / n);
const ornament = (x, y, r, band = false) =>
  `<rect x="${f(x - 5)}" y="${f(y - r - 8)}" width="10" height="9" rx="2"${D} stroke-width="4"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}"${W} stroke-width="5"/>` +
  (band ? thin(`<path d="M${f(x - r)} ${y}H${f(x + r)}"/>`) : '');
// 리본을 두른 선물 상자 (x: 왼쪽, base: 바닥)
function present(x, base, w, h, rib = 18) {
  const top = base - h;
  const c = x + w / 2;
  const lt = top - 14;
  return (
    `<rect x="${x}" y="${top}" width="${w}" height="${h}"${W}/>` +
    `<rect x="${x - 8}" y="${lt}" width="${w + 16}" height="22" rx="4"${W}/>` +
    `<path d="M${c - rib / 2} ${lt}V${base}M${c + rib / 2} ${lt}V${base}"/>` +
    `<path d="M${c} ${lt}C${c - 25} ${lt - 38} ${c - 53} ${lt - 26} ${c - 41} ${lt - 8}C${c - 35} ${lt + 2} ${c - 15} ${lt + 4} ${c} ${lt}Z"${W}/>` +
    `<path d="M${c} ${lt}C${c + 25} ${lt - 38} ${c + 53} ${lt - 26} ${c + 41} ${lt - 8}C${c + 35} ${lt + 2} ${c + 15} ${lt + 4} ${c} ${lt}Z"${W}/>` +
    `<ellipse cx="${c}" cy="${lt - 3}" rx="11" ry="9"${W}/>`
  );
}

const XMAS_TREE = svg(`
<path d="M0 540H800"/>
${thin(`${sparkle(90, 92, 20)}${sparkle(712, 92, 20)}${sparkle(150, 300, 14)}${sparkle(652, 300, 14)}${sparkle(56, 400, 11)}${sparkle(746, 400, 11)}<circle cx="210" cy="190" r="5"/><circle cx="590" cy="190" r="5"/><circle cx="60" cy="230" r="5"/><circle cx="742" cy="230" r="5"/>`)}
${flakes([[245, 70, 12], [556, 70, 12]])}
<rect x="380" y="418" width="40" height="50"${W}/>
${treeTier(TIERS[0])}
${garland(TIERS[0], 360, 18)}
${treeTier(TIERS[1])}
${garland(TIERS[1], 262, 16)}
${treeTier(TIERS[2])}
${garland(TIERS[2], 168, 15)}
${ornament(400, 140, 11, true)}
${ornament(cuspX(TIERS[2], 1), 234, 10)}${ornament(cuspX(TIERS[2], 4), 234, 10)}
${ornament(cuspX(TIERS[1], 2), 330, 11, true)}${ornament(cuspX(TIERS[1], 4), 330, 11, true)}
${ornament(cuspX(TIERS[0], 2), 430, 11)}${ornament(cuspX(TIERS[0], 5), 430, 11)}
<polygon points="${starPts(400, 62, 38)}"${W}/>
<path d="M345 486H455L440 540H360Z"${W}/>
<rect x="330" y="462" width="140" height="24" rx="6"${W}/>
${heart(400, 514, 11)}
${present(90, 540, 110, 70)}
${present(600, 540, 90, 92)}
`);

// 선물 상자 (규칙 무늬 칸)
const zigzagD = (x0, x1, y, amp, n) => {
  const w = (x1 - x0) / n;
  let d = `M${x0} ${y}`;
  for (let i = 1; i < n; i++) d += `L${f(x0 + i * w)} ${i % 2 ? y - amp : y + amp}`;
  return d + `L${x1} ${y}`;
};
const triUp = (x, y) => `<polygon points="${x - 18},${y + 17} ${x},${y - 17} ${x + 18},${y + 17}"/>`;
const triDown = (x, y) => `<polygon points="${x - 18},${y - 17} ${x},${y + 17} ${x + 18},${y - 17}"/>`;
const bowLoops = (c, y, s) =>
  `<path d="M${c} ${y}C${c - 40 * s} ${y - 58 * s} ${c - 104 * s} ${y - 54 * s} ${c - 88 * s} ${y - 18 * s}C${c - 78 * s} ${y + 4 * s} ${c - 32 * s} ${y + 6 * s} ${c} ${y}Z"${W}/>` +
  `<path d="M${c} ${y}C${c + 40 * s} ${y - 58 * s} ${c + 104 * s} ${y - 54 * s} ${c + 88 * s} ${y - 18 * s}C${c + 78 * s} ${y + 4 * s} ${c + 32 * s} ${y + 6 * s} ${c} ${y}Z"${W}/>`;
const balloon = (x, y, rx, ry, len) =>
  thin(`<path d="M${x} ${y + ry + 10}C${x - 14} ${y + ry + 40} ${x + 16} ${y + ry + 70} ${x} ${y + ry + len}"/>`) +
  `<polygon points="${x},${y + ry - 2} ${x - 8},${y + ry + 10} ${x + 8},${y + ry + 10}"${D} stroke-width="4"/>` +
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${W}/>` +
  thin(`<path d="M${x - rx * 0.55} ${y - ry * 0.3}Q${x - rx * 0.45} ${y - ry * 0.68} ${x - rx * 0.1} ${y - ry * 0.78}"/>`);

const GIFT_BOX = svg(`
<path d="M0 540H800"/>
${thin(`${sparkle(262, 112, 16)}${sparkle(540, 104, 18)}${sparkle(36, 330, 12)}${sparkle(766, 300, 12)}<circle cx="330" cy="70" r="5"/><circle cx="470" cy="62" r="5"/><circle cx="226" cy="214" r="5"/><circle cx="574" cy="206" r="5"/><circle cx="34" cy="80" r="5"/><circle cx="770" cy="70" r="5"/>`)}
${balloon(128, 140, 46, 56, 120)}
${balloon(680, 126, 44, 54, 110)}
<rect x="250" y="300" width="300" height="240"${W}/>
<path d="M250 386H382M418 386H550M250 463H382M418 463H550"/>
<g stroke-width="5">
${[272, 316, 360, 440, 484, 528].map((x) => `<circle cx="${x}" cy="347" r="15"/>`).join('')}
${[272, 316, 360, 440, 484, 528].map((x, i) => (i % 2 ? triDown(x, 424.5) : triUp(x, 424.5))).join('')}
${[272, 316, 360, 440, 484, 528].map((x) => heart(x, 503, 14)).join('')}
</g>
<rect x="232" y="252" width="336" height="56" rx="8"${W}/>
<path d="${zigzagD(232, 382, 280, 13, 8)}${zigzagD(418, 568, 280, 13, 8)}" stroke-width="5"/>
<path d="M382 252V540M418 252V540"/>
${bowLoops(400, 254, 1)}
${thin(`<path d="M384 246C366 226 344 220 330 228M416 246C434 226 456 220 470 228"/>`)}
<rect x="384" y="234" width="32" height="28" rx="9"${W}/>
<rect x="70" y="440" width="130" height="100"${W}/>
<g stroke-width="5"><circle cx="98" cy="474" r="10"/><circle cx="98" cy="514" r="10"/><circle cx="172" cy="474" r="10"/><circle cx="172" cy="514" r="10"/></g>
<rect x="60" y="420" width="150" height="30" rx="6"${W}/>
<path d="M126 420V540M144 420V540"/>
${bowLoops(135, 422, 0.5)}
<circle cx="135" cy="418" r="9"${W}/>
<rect x="600" y="390" width="110" height="150"${W}/>
<path d="M600 455H646M664 455H710M600 473H646M664 473H710"/>
${thin(`${star(623, 422, 15)}${star(687, 422, 15)}${star(623, 508, 15)}${star(687, 508, 15)}`)}
<rect x="590" y="368" width="130" height="30" rx="6"${W}/>
<path d="M646 368V540M664 368V540"/>
${bowLoops(655, 370, 0.55)}
<circle cx="655" cy="366" r="9"${W}/>
`);

// 펭귄 가족 (ox, oy: 발 아래 가운데, s: 크기. 높이 300 기준 좌표)
function penguin(ox, oy, s, kind) {
  const P = (x, y) => `${f(ox + x * s)} ${f(oy + y * s)}`;
  const X = (x) => f(ox + x * s);
  const Y = (y) => f(oy + y * s);
  const R = (r) => f(r * s);
  const flip = (k) =>
    `<path d="M${P(-84 * k, -192)}C${P(-128 * k, -170)} ${P(-150 * k, -112)} ${P(-136 * k, -80)}C${P(-120 * k, -78)} ${P(-100 * k, -108)} ${P(-86 * k, -126)}Z"${W}/>`;
  const baby = kind === 'baby';
  let out =
    flip(1) +
    flip(-1) +
    `<path d="M${P(0, -300)}C${P(72, -300)} ${P(98, -215)} ${P(96, -130)}C${P(94, -48)} ${P(70, 0)} ${P(0, 0)}C${P(-70, 0)} ${P(-94, -48)} ${P(-96, -130)}C${P(-98, -215)} ${P(-72, -300)} ${P(0, -300)}Z"${W}/>`;
  // 하얀 얼굴·배: 어른은 하트 모양 얼굴, 아기는 둥근 달걀 모양
  out += baby
    ? `<ellipse cx="${ox}" cy="${Y(-118)}" rx="${R(60)}" ry="${R(96)}" stroke-width="5"/>`
    : `<path d="M${P(0, -26)}C${P(-46, -26)} ${P(-64, -70)} ${P(-62, -124)}C${P(-60, -160)} ${P(-72, -194)} ${P(-58, -224)}C${P(-46, -248)} ${P(-14, -250)} ${P(0, -228)}C${P(14, -250)} ${P(46, -248)} ${P(58, -224)}C${P(72, -194)} ${P(60, -160)} ${P(62, -124)}C${P(64, -70)} ${P(46, -26)} ${P(0, -26)}Z" stroke-width="5"/>`;
  out +=
    `<ellipse cx="${X(-42)}" cy="${Y(-2)}" rx="${R(31)}" ry="${R(15)}"${W}/>` +
    `<ellipse cx="${X(42)}" cy="${Y(-2)}" rx="${R(31)}" ry="${R(15)}"${W}/>`;
  const ey = baby ? -180 : -206;
  out += eye(X(-28), Y(ey), R(9), R(12)) + eye(X(28), Y(ey), R(9), R(12));
  const by = baby ? -156 : -188;
  out += `<path d="M${P(-18, by)}Q${P(0, by - 8)} ${P(18, by)}L${P(0, by + 22)}Z"${W} stroke-width="${baby ? 4 : 5}"/>`;
  if (!baby) out += thin(`<ellipse cx="${X(-46)}" cy="${Y(-178)}" rx="${R(11)}" ry="${R(7)}"/><ellipse cx="${X(46)}" cy="${Y(-178)}" rx="${R(11)}" ry="${R(7)}"/>`);
  if (kind === 'tie') {
    out += `<g stroke-width="5"><polygon points="${P(-32, -156).replace(' ', ',')} ${P(0, -142).replace(' ', ',')} ${P(-32, -128).replace(' ', ',')}"${W}/><polygon points="${P(32, -156).replace(' ', ',')} ${P(0, -142).replace(' ', ',')} ${P(32, -128).replace(' ', ',')}"${W}/><circle cx="${X(0)}" cy="${Y(-142)}" r="8"${W}/></g>`;
  }
  if (kind === 'bow') {
    out += `<g stroke-width="5"><polygon points="${P(38, -288).replace(' ', ',')} ${P(10, -308).replace(' ', ',')} ${P(12, -268).replace(' ', ',')}"${W}/><polygon points="${P(38, -288).replace(' ', ',')} ${P(66, -308).replace(' ', ',')} ${P(64, -268).replace(' ', ',')}"${W}/><circle cx="${X(38)}" cy="${Y(-288)}" r="8"${W}/></g>`;
  }
  if (baby) {
    // 방울 달린 털모자
    out +=
      `<path d="M${P(-76, -246)}C${P(-76, -342)} ${P(76, -342)} ${P(76, -246)}Z"${W}/>` +
      `<rect x="${X(-84)}" y="${Y(-264)}" width="${R(168)}" height="${R(28)}" rx="${R(13)}"${W}/>` +
      thin(`<path d="${[-50, -17, 17, 50].map((x) => `M${X(x)} ${Y(-264)}V${Y(-236)}`).join('')}"/>`) +
      `<circle cx="${ox}" cy="${Y(-340)}" r="${R(22)}"${W}/>`;
  }
  return out;
}

const PENGUIN = svg(`
${sun(92, 88, 34)}
${cloud(690, 86, 72, 30)}
${flakes([[250, 62, 12], [400, 120, 11], [540, 60, 12], [330, 200, 9], [476, 214, 9], [30, 240, 9], [780, 196, 9]])}
<path d="M0 372H800"/>
<polygon points="18,372 58,306 92,322 128,262 168,318 202,372"${W}/>
<polygon points="600,372 640,292 674,308 712,238 752,298 800,286 800,372"${W}/>
${thin(`<path d="M128 262L118 302L132 332M712 238L700 282L716 316"/>`)}
${thin(`<path d="M682 402Q696 392 710 402M740 424Q754 414 768 424M300 400Q314 390 328 400M470 396Q484 386 498 396"/>`)}
<path d="M0 452Q200 438 400 450T800 446"/>
<ellipse cx="66" cy="546" rx="50" ry="17"${W}/>
${thin(`<ellipse cx="66" cy="546" rx="32" ry="9"/>`)}
<g transform="rotate(-24 74 500)">
<path d="M102 500L122 486V514Z"${W} stroke-width="5"/>
<ellipse cx="78" cy="500" rx="28" ry="14"${W} stroke-width="5"/>
<circle cx="64" cy="497" r="3.5"${D} stroke="none"/>
</g>
<path d="${cloudD(744, 530, 54, 30, 4)}"${W}/>
${penguin(200, 508, 0.95, 'tie')}
${penguin(605, 508, 0.88, 'bow')}
${penguin(402, 548, 0.6, 'baby')}
`);

// 관람차
const FERRIS_WHEEL = svg(`
${sun(92, 88, 34)}
${cloud(196, 70, 54, 24, 4)}
${cloud(690, 96, 64, 28)}
${thin(`<path d="M548 66Q558 56 568 66Q578 56 588 66M602 40Q610 32 618 40Q626 32 634 40"/>`)}
<path d="M0 544H800"/>
<rect x="320" y="468" width="160" height="14"${W}/>
<polygon points="388,250 402,256 318,528 290,528"${W}/>
<polygon points="412,250 398,256 482,528 510,528"${W}/>
<circle cx="400" cy="245" r="178"${W}/>
<circle cx="400" cy="245" r="156"/>
<circle cx="400" cy="245" r="74" stroke-width="5"/>
<path d="${spin('M400 221L400 89', 8, 0, 400, 245)}" stroke-width="5"/>
<circle cx="400" cy="245" r="24"${W}/>
<circle cx="400" cy="245" r="7"${D}/>
${Array.from({ length: 8 }, (_, i) => {
  const [x, y] = pt(400, 245, 167, -90 + i * 45);
  return (
    `<circle cx="${x}" cy="${y}" r="30"${W}/>` +
    thin(`<rect x="${f(x - 16)}" y="${f(y - 15)}" width="32" height="15" rx="5"/><path d="M${f(x - 29.4)} ${f(y + 6)}H${f(x + 29.4)}"/>`)
  );
}).join('')}
<rect x="255" y="520" width="290" height="24" rx="4"${W}/>
<rect x="30" y="360" width="90" height="184"${W}/>
<rect x="24" y="348" width="102" height="14" rx="3"${W}/>
${thin([380, 420, 460, 500].map((y) => `<rect x="45" y="${y}" width="22" height="22" rx="2"/><rect x="83" y="${y}" width="22" height="22" rx="2"/>`).join(''))}
<rect x="140" y="470" width="80" height="74"${W}/>
<polygon points="128,476 180,426 232,476"${W}/>
<circle cx="180" cy="458" r="9" stroke-width="5"/>
<rect x="168" y="506" width="24" height="38"/>
<rect x="575" y="420" width="110" height="124"${W}/>
<rect x="595" y="430" width="70" height="22" rx="5" stroke-width="5"/>
<path d="M567 462H693V478${bumpsD(693, 567, 478, 6)}Z"${W}/>
${thin(`<path d="M588 462V478M609 462V478M630 462V478M651 462V478M672 462V478"/>`)}
<rect x="595" y="500" width="26" height="44"/>
<rect x="633" y="500" width="38" height="28" rx="3"/>
<rect x="702" y="330" width="74" height="214"${W}/>
<path d="M739 330V300"/>
<circle cx="739" cy="294" r="7"${W}/>
${thin([352, 394, 436, 478].map((y) => `<rect x="716" y="${y}" width="18" height="26" rx="2"/><rect x="744" y="${y}" width="18" height="26" rx="2"/>`).join(''))}
`);

// 책 읽는 곰
const READING_BEAR = svg(`
<path d="M0 450H800"/>
<rect x="55" y="70" width="150" height="130" rx="6"${W}/>
${thin(`<path d="M130 70V200M55 135H205"/>`)}
<path d="${crescentD(94, 104, 18, 9, -7, 15)}" stroke-width="5"/>
<polygon points="${starPts(168, 104, 13)}" stroke-width="5"/>
<rect x="45" y="200" width="170" height="14" rx="4"${W}/>
<rect x="604" y="128" width="22" height="72" rx="3"${W}/>
<rect x="628" y="140" width="24" height="60" rx="3"${W}/>
<rect x="654" y="118" width="20" height="82" rx="3"${W}/>
${thin(`<path d="M604 146H626M604 182H626M654 136H674M654 182H674"/>`)}
<ellipse cx="710" cy="140" rx="10" ry="22" transform="rotate(-30 710 140)"${W} stroke-width="5"/>
<ellipse cx="736" cy="140" rx="10" ry="22" transform="rotate(30 736 140)"${W} stroke-width="5"/>
<path d="M700 168H746L740 200H706Z"${W}/>
<rect x="590" y="200" width="170" height="12" rx="3"${W}/>
${thin(`${sparkle(276, 62, 14)}${sparkle(528, 60, 14)}${sparkle(560, 262, 12)}${sparkle(240, 262, 12)}<circle cx="252" cy="150" r="5"/><circle cx="560" cy="160" r="5"/>`)}
<ellipse cx="400" cy="530" rx="250" ry="36"${W}/>
${thin(`<ellipse cx="400" cy="530" rx="222" ry="23"/>`)}
<path d="M330 292C268 325 250 440 280 520H520C550 440 532 325 470 292Z"${W}/>
${thin(`<ellipse cx="400" cy="452" rx="68" ry="56"/>`)}
<circle cx="322" cy="118" r="34"${W}/>
<circle cx="478" cy="118" r="34"${W}/>
${thin(`<circle cx="322" cy="118" r="17"/><circle cx="478" cy="118" r="17"/>`)}
<circle cx="400" cy="190" r="96"${W}/>
<ellipse cx="400" cy="230" rx="44" ry="33"${W}/>
<ellipse cx="400" cy="214" rx="16" ry="11"${D}/>
${thin(`<path d="M400 225V238M400 238Q390 248 379 241M400 238Q410 248 421 241"/><ellipse cx="334" cy="228" rx="14" ry="9"/><ellipse cx="466" cy="228" rx="14" ry="9"/>`)}
${eye(362, 186, 8, 10)}${eye(438, 186, 8, 10)}
<ellipse cx="325" cy="505" rx="46" ry="28"${W}/>
<ellipse cx="475" cy="505" rx="46" ry="28"${W}/>
${thin(`<ellipse cx="325" cy="510" rx="20" ry="12"/><ellipse cx="475" cy="510" rx="20" ry="12"/><circle cx="305" cy="489" r="6"/><circle cx="325" cy="485" r="6"/><circle cx="345" cy="489" r="6"/><circle cx="455" cy="489" r="6"/><circle cx="475" cy="485" r="6"/><circle cx="495" cy="489" r="6"/>`)}
<path d="M400 322C362 304 312 304 276 318L268 426C306 414 362 416 400 436C438 416 494 414 532 426L524 318C488 304 438 304 400 322Z"${W}/>
<path d="M400 310C366 292 318 292 284 306L278 412C314 402 364 404 400 422Z"${W}/>
<path d="M400 310C434 292 482 292 516 306L522 412C486 402 436 404 400 422Z"${W}/>
${thin(`<path d="M300 334Q340 326 384 336M298 356Q340 348 384 358M296 378Q338 370 384 380"/>`)}
<polygon points="${starPts(460, 354, 27)}" stroke-width="4"/>
<ellipse cx="284" cy="392" rx="26" ry="22"${W}/>
<ellipse cx="516" cy="392" rx="26" ry="22"${W}/>
<rect x="40" y="481" width="170" height="44" rx="6"${W}/>
${thin(`<path d="M62 481V525M188 481V525"/>`)}
<rect x="56" y="441" width="146" height="40" rx="6"${W}/>
${thin(`<path d="M80 441V481M178 441V481"/>`)}
<rect x="48" y="405" width="158" height="36" rx="6"${W}/>
${thin(`<rect x="100" y="414" width="54" height="18" rx="3"/>`)}
${apple(128, 385, 20)}
<path d="M630 456H730V505Q730 525 710 525H650Q630 525 630 505Z"${W}/>
<path d="M730 468C768 468 768 518 730 518M730 481C752 481 752 505 730 505"/>
<ellipse cx="680" cy="456" rx="50" ry="10"${W}/>
${heart(680, 494, 13)}
${thin(`<path d="M662 436C652 418 672 408 662 390M698 436C688 418 708 408 698 390"/>`)}
`);

// ---------------------------------------------------------------------------
// 목록
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATES = [
  {
    id: 'builtin:cat',
    title: '고양이',
    category: '동물',
    keywords: ['고양이', '냥이', '야옹이', '야옹', '아기고양이', '새끼고양이', '털실', 'cat', 'kitten', 'kitty'],
    svg: CAT,
  },
  {
    id: 'builtin:dog',
    title: '강아지',
    category: '동물',
    keywords: ['강아지', '개', '멍멍이', '멍멍', '댕댕이', '멍뭉이', '뼈다귀', 'dog', 'puppy', 'doggy'],
    svg: DOG,
  },
  {
    id: 'builtin:rabbit',
    title: '토끼',
    category: '동물',
    keywords: ['토끼', '산토끼', '토깽이', '당근', '바니', 'rabbit', 'bunny', 'carrot'],
    svg: RABBIT,
  },
  {
    id: 'builtin:fish',
    title: '물고기',
    category: '동물',
    keywords: ['물고기', '고기', '생선', '금붕어', '열대어', '바다', '바닷속', '물속', '수족관', 'fish', 'goldfish', 'sea', 'ocean', 'underwater'],
    svg: FISH,
  },
  {
    id: 'builtin:butterfly',
    title: '나비',
    category: '동물',
    keywords: ['나비', '호랑나비', '곤충', '벌레', 'butterfly', 'insect', 'bug'],
    svg: BUTTERFLY,
  },
  {
    id: 'builtin:dinosaur',
    title: '공룡',
    category: '동물',
    keywords: ['공룡', '아기공룡', '브라키오사우루스', '공룡알', '쥬라기', '디노', 'dinosaur', 'dino', 'jurassic'],
    svg: DINO,
  },
  {
    id: 'builtin:owl',
    title: '부엉이',
    category: '동물',
    keywords: ['부엉이', '올빼미', '새', '밤', '밤하늘', '달', 'owl', 'bird', 'night'],
    svg: OWL,
  },
  {
    id: 'builtin:house',
    title: '우리 집',
    category: '생활',
    keywords: ['집', '우리집', '주택', '지붕', '건물', '마을', 'house', 'home', 'building'],
    svg: HOUSE,
  },
  {
    id: 'builtin:tree',
    title: '사과나무',
    category: '자연',
    keywords: ['나무', '사과나무', '사과', '과일나무', '숲', 'tree', 'apple', 'forest'],
    svg: TREE,
  },
  {
    id: 'builtin:flowerpot',
    title: '화분 꽃',
    category: '자연',
    keywords: ['꽃', '화분', '꽃화분', '튤립', '데이지', '식물', '정원', 'flower', 'flowers', 'flowerpot', 'plant', 'tulip', 'daisy'],
    svg: FLOWERPOT,
  },
  {
    id: 'builtin:weather',
    title: '해와 무지개',
    category: '자연',
    keywords: ['날씨', '해', '해님', '햇님', '태양', '구름', '무지개', '비', '하늘', 'weather', 'sun', 'sunny', 'cloud', 'rainbow', 'rain', 'sky'],
    svg: WEATHER,
  },
  {
    id: 'builtin:car',
    title: '자동차',
    category: '탈것',
    keywords: ['자동차', '차', '붕붕', '붕붕카', '승용차', '도로', 'car', 'auto', 'automobile', 'vehicle'],
    svg: CAR,
  },
  {
    id: 'builtin:rocket',
    title: '우주 로켓',
    category: '탈것',
    keywords: ['로켓', '우주', '우주선', '행성', '토성', '별', '달', 'rocket', 'space', 'spaceship', 'planet', 'star', 'galaxy'],
    svg: ROCKET,
  },
  {
    id: 'builtin:sailboat',
    title: '배와 바다',
    category: '탈것',
    keywords: ['배', '돛단배', '요트', '바다', '파도', '항해', 'boat', 'ship', 'sailboat', 'sail', 'sea', 'ocean'],
    svg: SAILBOAT,
  },
  {
    id: 'builtin:cake',
    title: '생일 케이크',
    category: '생활',
    keywords: ['케이크', '케익', '생일', '생일케이크', '축하', '파티', '촛불', 'cake', 'birthday', 'party'],
    svg: CAKE,
  },
  {
    id: 'builtin:icecream',
    title: '아이스크림',
    category: '생활',
    keywords: ['아이스크림', '아이스', '콘', '디저트', '간식', '체리', 'ice cream', 'icecream', 'dessert', 'cone'],
    svg: ICECREAM,
  },
  {
    id: 'builtin:mandala',
    title: '꽃 만다라',
    category: '패턴',
    keywords: ['만다라', '패턴', '무늬', '문양', '도형', '대칭', 'mandala', 'pattern', 'symmetry'],
    svg: MANDALA,
  },
  {
    id: 'builtin:castle',
    title: '동화 속 성',
    category: '상상',
    keywords: ['성', '궁전', '공주', '왕자', '동화', '요정', '왕국', 'castle', 'palace', 'princess', 'prince', 'fairy', 'kingdom'],
    svg: CASTLE,
  },
  {
    id: 'builtin:snow-village',
    title: '눈사람과 겨울 풍경',
    category: '자연',
    keywords: ['눈사람', '눈오는날', '눈송이', '함박눈', '눈싸움', '겨울', '겨울마을', '전나무', '목도리', 'snowman', 'snow', 'winter', 'snowflake'],
    svg: SNOW_VILLAGE,
  },
  {
    id: 'builtin:xmas-tree',
    title: '크리스마스 트리',
    category: '생활',
    keywords: ['크리스마스', '크리스마스트리', '성탄절', '성탄', '트리', '오너먼트', '연말', '산타', 'christmas', 'xmas', 'santa'],
    svg: XMAS_TREE,
  },
  {
    id: 'builtin:gift-box',
    title: '선물 상자',
    category: '생활',
    keywords: ['선물', '선물상자', '상자', '리본', '풍선', '규칙', '반복무늬', 'gift', 'present', 'box', 'ribbon', 'balloon'],
    svg: GIFT_BOX,
  },
  {
    id: 'builtin:penguin',
    title: '펭귄 가족',
    category: '동물',
    keywords: ['펭귄', '아기펭귄', '펭귄가족', '남극', '북극', '빙하', '빙산', '얼음', 'penguin', 'antarctica', 'iceberg'],
    svg: PENGUIN,
  },
  {
    id: 'builtin:ferris-wheel',
    title: '관람차',
    category: '탈것',
    keywords: ['관람차', '회전관람차', '놀이공원', '놀이동산', '동네', '우리동네', '도시', '빌딩', 'ferris', 'amusement', 'town', 'city'],
    svg: FERRIS_WHEEL,
  },
  {
    id: 'builtin:reading-bear',
    title: '책 읽는 곰',
    category: '동물',
    keywords: ['곰', '곰돌이', '아기곰', '책', '독서', '책읽기', '도서관', '이야기', '동화책', 'bear', 'teddy', 'book', 'reading'],
    svg: READING_BEAR,
  },
];

// ---------------------------------------------------------------------------
// 검색
// ---------------------------------------------------------------------------

// 낱말 뒤에 붙는 조사 (예: "고양이를" → "고양이", "배랑" → "배")
const PARTICLES = ['이랑', '에서', '으로', '한테', '처럼', '하고', '이요', '을', '를', '이', '가', '은', '는', '와', '과', '랑', '도', '의', '에', '로', '요'];
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

const normalize = (s) => String(s).normalize('NFC').toLowerCase();
const tokenize = (s) => normalize(s).split(/[^0-9a-zᄀ-ᇿ㄰-㆏가-힣]+/).filter(Boolean);

function variants(token) {
  const out = [token];
  if (HANGUL.test(token)) {
    for (const p of PARTICLES) {
      if (token.length > p.length && token.endsWith(p)) out.push(token.slice(0, -p.length));
    }
  }
  return out;
}

function scoreWord(token, word) {
  const vs = variants(token);
  if (word === token) return 100;
  if (vs.includes(word)) return 95;
  const hangul = HANGUL.test(word) || HANGUL.test(token);
  let best = 0;
  if (hangul) {
    // 한글: 양방향 부분 일치 ("고양이그려줘" ⊃ "고양이", "고양" ⊂ "고양이")
    if (word.length >= 2 && token.includes(word)) best = Math.max(best, 60 + word.length);
    for (const v of vs) if (v.length >= 2 && word.includes(v)) best = Math.max(best, 40 + v.length);
  } else {
    // 영어: 복수형/접두 일치 ("rockets" → "rocket", "ice" → "ice cream")
    if (word.length >= 3 && token.startsWith(word)) best = Math.max(best, 55);
    if (token.length >= 3 && word.includes(token)) best = Math.max(best, 40);
  }
  return best;
}

/**
 * 검색어와 어울리는 기본 도안을 찾아 잘 맞는 순서대로 돌려준다.
 * @param {string} query 예: '고양이 그려줘', 'rocket', '바다'
 * @returns {Array} BUILTIN_TEMPLATES 원소 배열 (일치 없음 → 빈 배열)
 */
export function findBuiltinTemplates(query) {
  if (query == null) return [];
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored = [];
  BUILTIN_TEMPLATES.forEach((t, index) => {
    const titleWords = tokenize(t.title);
    const words = [...new Set([normalize(t.title), ...titleWords, ...t.keywords.map(normalize)])];
    let score = 0;
    for (const token of tokens) {
      let best = 0;
      for (const w of words) best = Math.max(best, scoreWord(token, w) + (titleWords.includes(w) ? 5 : 0));
      if (best > 5) score += best;
    }
    if (score > 0) scored.push({ t, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.t);
}
