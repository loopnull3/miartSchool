// 학교 기준 날짜 (기본: 한국 시간)
const TZ = process.env.TZ_NAME || 'Asia/Seoul';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function localDay(d = new Date()) {
  return fmt.format(d);
}
