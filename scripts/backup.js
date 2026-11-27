// 데이터 백업: 서버를 멈추지 않고 DB를 안전하게 복사(VACUUM INTO)하고 그림·작업 파일을 함께 복사한다.
//   npm run backup                 → ./backups/miart-날짜시각/
//   node scripts/backup.js /경로   → /경로/miart-날짜시각/
// Docker: docker compose exec app node scripts/backup.js /data/backups
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
const dbFile = path.join(dataDir, 'miart.db');
if (!fs.existsSync(dbFile)) {
  console.error(`DB 파일이 없어요: ${dbFile} (DATA_DIR을 확인하세요)`);
  process.exit(1);
}
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const out = path.resolve(process.argv[2] || './backups', `miart-${stamp}`);
fs.mkdirSync(out, { recursive: true });

const db = new DatabaseSync(dbFile);
const target = path.join(out, 'miart.db');
db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
db.close();

for (const dir of ['images', 'drafts']) {
  const src = path.join(dataDir, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, dir), { recursive: true });
}
console.log(`백업 완료: ${out}`);
console.log('복원: 서버를 멈추고 이 폴더의 내용을 DATA_DIR에 덮어쓴 뒤 다시 시작하세요.');
