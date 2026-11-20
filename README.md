# 미아트스쿨 (MiArt School)

학교·학원을 위한 디지털 미술 수업 플랫폼입니다. 아이패드·태블릿·크롬북 브라우저에서 바로 쓰며, 아트봉봉스쿨이 제공하는 기능(디지털 드로잉, 사진→도안, AI 주제 도안, 그림심리검사, 교사용 학급 리포트, 허가된 학교 전용)을 웹 앱 하나로 구현했습니다.

- **앱 설치 없음**: 웹 앱(PWA)이라 iPad Safari에서 "홈 화면에 추가"로 앱처럼 씁니다.
- **자체 서버 운영**: Node.js + 내장 SQLite(`node:sqlite`)만 사용합니다. 네이티브 모듈이 없어 Linux 서버, macOS, Windows, **Android Termux**에서 그대로 실행됩니다.
- **AI는 선택**: AI 키가 없어도 AI 주제 도안과 AI 요약을 뺀 모든 기능이 동작합니다.

## 기능

| 영역 | 내용 |
|---|---|
| 🖌️ 드로잉 스튜디오 | 연필·사인펜·크레파스·마커·수채화·유화·스프레이·무지개펜·지우개 9종, 종이 질감, 레이어 6개, 채우기(도안 선을 경계로 인식), 스탬프, 스포이드, 실행 취소/다시 실행, 두 손가락 확대·이동, 애플펜슬 필압, 손바닥 터치 무시 |
| 🖼️ 기본 도안 18종 | 동물·자연·탈것·생활·상상·패턴. 모든 칸이 닫혀 있어 채우기로 한 번에 칠해짐 |
| 📷 사진으로 도안 | 사진 → 색칠용 선화. 색 차이까지 잡는 윤곽 추출, 세밀함·선 굵기 조절. **사진은 서버로 보내지 않고 기기 안에서 처리** |
| ✨ AI 주제 도안 | "우주를 나는 고래"처럼 말로 설명하면 Claude가 SVG 선화를 그림. 서버에서 안전한 도형만 남기도록 정리. 아이에게 맞지 않는 주제는 다정하게 거절. 학급별 켜기/끄기, 하루 사용량 제한 |
| 🏫 학급·과제 | 학급 코드 + 4자리 PIN 로그인(이메일 불필요), 학생 일괄 등록, 로그인 카드 인쇄, 과제(도안·방향·마감일), 제출 현황 |
| 🏅 피드백·전시 | 칭찬 도장 8종 + 한마디, 학생에게 새 칭찬 알림, 우리 반 전시회 |
| 💗 그림 마음 탐색 | 집-나무-사람(HTP) 그리기 + 그림 뒤 질문 + "내 마음 날씨" 자기 보고. 드로잉 지표(크기·위치·색·필압·지우기·시간)와 답변으로 5개 영역 점수, 마음 날씨, 관심 신호, 강점·지도 팁·대화 질문을 만듦. 학급 리포트, 교사 메모, 선택형 AI 요약(그림 3장을 Claude가 함께 해석, **아이 이름은 보내지 않음**). 아이에게는 긍정적인 한마디만 보여 줌 |
| 🔒 허가된 학교만 | 관리자가 학교(기관) 인증 코드를 발급 → 그 코드로 가입한 교사는 바로 사용, 코드가 없으면 관리자 승인 후 사용 |

> 그림 마음 탐색은 진단 도구가 아니라 교사가 아이를 이해하기 위한 참고 자료입니다. 화면과 리포트에 이 안내가 항상 함께 표시됩니다.

## 빠른 시작

Node.js 22.5 이상이 필요합니다.

```bash
npm install
```

```bash
cp .env.example .env
```

`.env`에서 `ADMIN_EMAIL`, `ADMIN_PASSWORD`를 바꾸고, AI 기능을 쓰려면 `ANTHROPIC_API_KEY`를 넣으세요.

```bash
npm start
```

브라우저에서 `http://localhost:3000` 을 엽니다. 같은 와이파이의 아이패드에서는 `http://<서버 IP>:3000` 으로 접속합니다.

### 데모 데이터로 둘러보기

```bash
npm run seed
```

| 역할 | 로그인 |
|---|---|
| 관리자 | admin@miart.school / admin1234 |
| 선생님 | teacher@miart.school / teacher1234 |
| 학생 | 학생 입장 → 학급 코드 `DEMO23` → 이름 선택 → PIN (1번 1111, 2번 2222 …) |

### Termux(안드로이드)에서 실행

Ubuntu/PRoot 없이 Termux에서 바로 동작합니다.

```bash
pkg install nodejs git
```

```bash
git clone https://github.com/loopnull3/miartSchool && cd miartSchool && npm install && npm start
```

## 운영 메모

- **데이터 위치**: `DATA_DIR`(기본 `./data`)에 SQLite DB(`miart.db`), 작품 이미지(`images/`), 레이어 작업 파일(`drafts/`)이 저장됩니다. 이 폴더만 백업하면 됩니다.
- **HTTPS**: 실제 운영은 Nginx/Caddy 등 HTTPS 리버스 프록시 뒤에서 하고 `.env`에 `COOKIE_SECURE=true`를 설정하세요. 아이패드 카메라로 사진을 찍는 기능은 HTTPS(또는 localhost)에서만 동작합니다.
- **AI 비용 관리**: `AI_DAILY_LIMIT_PER_CLASS`(기본 60회)로 학급별 하루 AI 호출 수를 제한합니다. 모델은 `claude-opus-5-5`이며 `MIART_AI_MODEL`로 바꿀 수 있습니다.
- **보안**: 비밀번호는 scrypt 해시, 세션은 httpOnly 쿠키(교사 14일, 학생 12시간), 변경 요청은 전용 헤더로 CSRF 차단, 로그인·PIN 시도 횟수 제한, 업로드 이미지는 PNG/JPEG 시그니처 검사, 작품·검사 이미지는 권한 확인 후에만 제공됩니다.

## 구조

```
server/            Express 5 API
  index.js         앱 구성, 정적 파일, 오류 처리, 관리자 계정 준비
  db.js            node:sqlite 스키마
  auth.js          세션, 비밀번호, 권한 검사, 시도 제한
  routes/          auth · admin · classes · artworks · templates · psych
  psych/analyze.js 그림 마음 탐색 규칙 기반 분석
  ai/claude.js     Claude API (AI 도안 SVG 생성, 마음 탐색 AI 요약)
  ai/svg-sanitize.js  AI SVG 허용 목록 정리
shared/            서버와 브라우저가 함께 쓰는 모듈 (기본 도안, 검사 문항)
public/            빌드 없는 바닐라 JS 프런트엔드 (ES 모듈)
  js/studio/       드로잉 엔진 (브러시, 채우기, 실행 취소, 레이어)
  js/photo-sketch.js  사진 → 선화 변환
  js/views/        화면
scripts/seed-demo.js
test/              node:test (분석, API 권한·흐름, AI 요청 형태 — 가짜 API 서버 사용)
```

## 테스트

```bash
npm test
```

AI 테스트는 로컬 가짜 Messages API 서버를 띄워 요청 형태(모델, 구조화 출력, 서버 측 대체 모델 설정)와 응답 처리, 학생 이름이 전송되지 않는지를 확인하며 실제 API를 호출하지 않습니다.
