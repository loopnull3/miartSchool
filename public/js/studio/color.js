// 색상 도우미
export const PALETTE = [
  '#222222', '#6b6b6b', '#ffffff', '#8b5a2b', '#c98b55', '#f7c6a3',
  '#e53935', '#ff7043', '#fb8c00', '#fdd835', '#fff176', '#c0ca33',
  '#43a047', '#2e7d32', '#26a69a', '#4fc3f7', '#1e88e5', '#283593',
  '#8e24aa', '#b39ddb', '#f06292', '#f8bbd0', '#c9a227', '#f5e6c8',
];

export const PSYCH_PALETTE = ['#222222', '#6b6b6b', '#8b5a2b', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#26a69a', '#1e88e5', '#283593', '#8e24aa', '#f06292'];

export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function hsl(hex) {
  let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hh = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hh = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
  }
  return { h: hh, s, l };
}

// 색 분류: 어두운색 / 따뜻한색 / 차가운색
export function classifyColor(hex) {
  const { h, s, l } = hsl(hex);
  const dark = l < 0.25 || (s < 0.18 && l < 0.45);
  const warm = !dark && s > 0.3 && l < 0.9 && (h < 65 || h >= 320);
  const cool = !dark && s > 0.25 && h >= 160 && h < 290;
  return { dark, warm, cool };
}
