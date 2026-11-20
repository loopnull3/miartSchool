// 채우기 (모든 보이는 레이어 + 도안 선을 경계로 사용, 결과는 현재 레이어에 칠함)
// ref: 기준 이미지 RGBA(흰 바탕 합성), barrier: 도안 선 마스크(Uint8Array, 1=선)
export function floodFill({ ref, barrier, target, width: W, height: H, x, y, color, tolerance = 40 }) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const seedIdx = y * W + x;
  if (barrier && barrier[seedIdx]) return null;
  const rd = ref.data;
  const sr = rd[seedIdx * 4];
  const sg = rd[seedIdx * 4 + 1];
  const sb = rd[seedIdx * 4 + 2];
  const tol = tolerance * 3;
  const match = (i) => {
    if (barrier && barrier[i]) return false;
    const o = i * 4;
    return Math.abs(rd[o] - sr) + Math.abs(rd[o + 1] - sg) + Math.abs(rd[o + 2] - sb) <= tol;
  };

  const filled = new Uint8Array(W * H);
  const stack = [x, y];
  let minX = x, maxX = x, minY = y, maxY = y;
  while (stack.length) {
    const py = stack.pop();
    const px = stack.pop();
    let lx = px;
    let i = py * W + px;
    if (filled[i] || !match(i)) continue;
    while (lx > 0 && !filled[i - 1] && match(i - 1)) {
      lx--;
      i--;
    }
    let rx = lx;
    let upOpen = false;
    let downOpen = false;
    i = py * W + lx;
    while (rx < W && !filled[i] && match(i)) {
      filled[i] = 1;
      if (py > 0) {
        const up = i - W;
        const ok = !filled[up] && match(up);
        if (ok && !upOpen) stack.push(rx, py - 1);
        upOpen = ok;
      }
      if (py < H - 1) {
        const dn = i + W;
        const ok = !filled[dn] && match(dn);
        if (ok && !downOpen) stack.push(rx, py + 1);
        downOpen = ok;
      }
      rx++;
      i++;
    }
    if (lx < minX) minX = lx;
    if (rx - 1 > maxX) maxX = rx - 1;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // 경계 안티에일리어싱 틈을 메우기 위해 1px(선 아래는 2px) 팽창
  const grow = (pass, onlyBarrier) => {
    const add = [];
    for (let yy = Math.max(0, minY - 1); yy <= Math.min(H - 1, maxY + 1); yy++) {
      for (let xx = Math.max(0, minX - 1); xx <= Math.min(W - 1, maxX + 1); xx++) {
        const j = yy * W + xx;
        if (filled[j]) continue;
        if (onlyBarrier && !(barrier && barrier[j])) continue;
        if ((xx > 0 && filled[j - 1] === pass) || (xx < W - 1 && filled[j + 1] === pass) || (yy > 0 && filled[j - W] === pass) || (yy < H - 1 && filled[j + W] === pass)) add.push(j);
      }
    }
    for (const j of add) filled[j] = pass + 1;
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(W - 1, maxX + 1);
    maxY = Math.min(H - 1, maxY + 1);
  };
  grow(1, false);
  grow(2, true);

  const rx0 = minX, ry0 = minY, rw = maxX - minX + 1, rh = maxY - minY + 1;
  const region = target.getImageData(rx0, ry0, rw, rh);
  const before = new ImageData(new Uint8ClampedArray(region.data), rw, rh);
  const [cr, cg, cb] = color;
  let count = 0;
  for (let yy = 0; yy < rh; yy++) {
    for (let xx = 0; xx < rw; xx++) {
      if (!filled[(ry0 + yy) * W + rx0 + xx]) continue;
      const o = (yy * rw + xx) * 4;
      region.data[o] = cr;
      region.data[o + 1] = cg;
      region.data[o + 2] = cb;
      region.data[o + 3] = 255;
      count++;
    }
  }
  if (!count) return null;
  target.putImageData(region, rx0, ry0);
  return { rect: { x: rx0, y: ry0, w: rw, h: rh }, before, after: region };
}
