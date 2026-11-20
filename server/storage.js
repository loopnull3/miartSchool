// 이미지/초안 파일 저장
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IMAGE_DIR, DRAFT_DIR } from './db.js';
import { HttpError } from './auth.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

// data:image/png;base64,... → 파일 저장, 파일명 반환
export function saveDataUrlImage(dataUrl, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (typeof dataUrl !== 'string') throw new HttpError(400, '이미지가 없습니다.');
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, '지원하지 않는 이미지 형식입니다.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) throw new HttpError(413, '이미지가 너무 큽니다.');
  const ext = m[1] === 'png' ? 'png' : 'jpg';
  const magic = ext === 'png' ? PNG_MAGIC : JPEG_MAGIC;
  if (!buf.subarray(0, magic.length).equals(magic)) throw new HttpError(400, '이미지 파일이 손상되었습니다.');
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(IMAGE_DIR, name), buf);
  return name;
}

export function imagePath(name) {
  if (!name || !/^[0-9a-f-]{36}\.(png|jpg)$/.test(name)) return null;
  return path.join(IMAGE_DIR, name);
}

export function removeImage(name) {
  const p = imagePath(name);
  if (p) fs.rm(p, { force: true }, () => {});
}

export function sendImage(res, name) {
  const p = imagePath(name);
  if (!p || !fs.existsSync(p)) throw new HttpError(404, '이미지가 없습니다.');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(p);
}

// 레이어 초안(JSON) 저장
export function saveDraft(existingName, draft) {
  const json = JSON.stringify(draft);
  if (json.length > 40 * 1024 * 1024) throw new HttpError(413, '작업 파일이 너무 큽니다.');
  const name = existingName && /^[0-9a-f-]{36}\.json$/.test(existingName) ? existingName : `${crypto.randomUUID()}.json`;
  fs.writeFileSync(path.join(DRAFT_DIR, name), json);
  return name;
}

export function readDraft(name) {
  if (!name || !/^[0-9a-f-]{36}\.json$/.test(name)) return null;
  const p = path.join(DRAFT_DIR, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function removeDraft(name) {
  if (!name || !/^[0-9a-f-]{36}\.json$/.test(name)) return;
  fs.rm(path.join(DRAFT_DIR, name), { force: true }, () => {});
}
