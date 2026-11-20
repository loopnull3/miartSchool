// AI가 만든 SVG를 색칠 도안용 안전한 SVG로 다시 조립한다.
// 허용 목록에 있는 도형 요소·속성만 남기고, 색은 검은 선 + 흰/투명 면으로 강제한다.

const SHAPES = {
  svg: ['viewBox'],
  g: [],
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
};
const COMMON = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'fill-rule'];

const NUM = /^-?\d*\.?\d+(e-?\d+)?$/i;
const PATH_D = /^[0-9eE.,\s\-+MmLlHhVvCcSsQqTtAaZz]*$/;
const POINTS = /^[0-9eE.,\s\-+]*$/;
const TRANSFORM = /^((translate|rotate|scale)\(\s*[-0-9.eE,\s]+\)\s*)+$/;

function cleanFill(v) {
  const s = String(v).trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return 'none';
  if (['white', '#fff', '#ffffff'].includes(s)) return 'white';
  if (['black', '#000', '#000000', '#111', '#111111', '#222', '#222222', '#333', '#333333'].includes(s)) return '#222';
  return 'none';
}

function cleanAttr(tag, name, value) {
  const v = String(value).trim();
  if (/url\(|javascript:|expression\(/i.test(v)) return null;
  switch (name) {
    case 'viewBox': {
      const parts = v.split(/[\s,]+/);
      return parts.length === 4 && parts.every((p) => NUM.test(p)) ? parts.join(' ') : null;
    }
    case 'd':
      return PATH_D.test(v) && v.length < 20000 ? v.replace(/\s+/g, ' ') : null;
    case 'points':
      return POINTS.test(v) ? v.replace(/\s+/g, ' ') : null;
    case 'transform':
      return TRANSFORM.test(v) ? v : null;
    case 'fill':
      return cleanFill(v);
    case 'stroke':
      return v.toLowerCase() === 'none' ? 'none' : '#222';
    case 'stroke-width': {
      const n = parseFloat(v);
      return Number.isFinite(n) ? String(Math.min(14, Math.max(1, n))) : null;
    }
    case 'stroke-linecap':
      return ['round', 'butt', 'square'].includes(v) ? v : null;
    case 'stroke-linejoin':
      return ['round', 'miter', 'bevel'].includes(v) ? v : null;
    case 'fill-rule':
      return ['nonzero', 'evenodd'].includes(v) ? v : null;
    default:
      return NUM.test(v) ? v : null;
  }
}

export function sanitizeSvg(input) {
  const src = String(input || '');
  const start = src.search(/<svg[\s>]/i);
  const end = src.lastIndexOf('</svg>');
  if (start === -1 || end === -1) throw new Error('SVG를 찾을 수 없습니다.');
  const body = src.slice(start, end + 6);
  if (body.length > 120000) throw new Error('SVG가 너무 큽니다.');

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*?)(\/?)>/g;
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  const out = [];
  const stack = [];
  let skipDepth = 0;
  let shapeCount = 0;
  let m;
  while ((m = tagRe.exec(body))) {
    const [, closing, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    const allowed = Object.hasOwn(SHAPES, tag);
    if (closing) {
      if (skipDepth > 0) {
        skipDepth -= 1;
        continue;
      }
      if (allowed && stack[stack.length - 1] === tag) {
        stack.pop();
        out.push(`</${tag}>`);
      }
      continue;
    }
    if (skipDepth > 0 || !allowed) {
      if (!selfClose && !(skipDepth === 0 && !allowed && isVoidish(tag))) skipDepth += 1;
      continue;
    }
    if (tag === 'svg' && stack.length > 0) {
      if (!selfClose) skipDepth += 1;
      continue;
    }
    const kept = [];
    const names = new Set([...SHAPES[tag], ...COMMON]);
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(attrs))) {
      const name = a[1];
      const lname = name === 'viewBox' ? 'viewBox' : name.toLowerCase();
      if (!names.has(lname)) continue;
      const cleaned = cleanAttr(tag, lname, a[3] ?? a[4] ?? '');
      if (cleaned != null) kept.push(`${lname}="${cleaned}"`);
    }
    if (tag === 'svg') {
      if (!kept.some((x) => x.startsWith('viewBox='))) kept.push('viewBox="0 0 800 600"');
      kept.unshift('xmlns="http://www.w3.org/2000/svg"');
    } else {
      shapeCount += 1;
    }
    if (shapeCount > 800) break;
    if (selfClose) out.push(`<${tag} ${kept.join(' ')}/>`);
    else {
      out.push(`<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`);
      stack.push(tag);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  if (shapeCount === 0) throw new Error('그림 요소가 없습니다.');
  return out.join('');
}

// 닫는 태그가 없을 가능성이 큰 요소는 건너뛰기 깊이를 늘리지 않는다
function isVoidish(tag) {
  return ['br', 'img', 'image', 'use', 'stop', 'meta', 'link'].includes(tag);
}
