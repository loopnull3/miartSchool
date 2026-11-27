# public/vendor — 직접 호스팅하는 외부 라이브러리

실행 중에는 CDN을 쓰지 않고 이 폴더의 파일만 사용합니다 (학교망 차단·오프라인 대비).
아래 파일은 npm 레지스트리 배포본을 그대로 복사한 것이며, 수정하지 않았습니다
(패키지 스크립트는 실행하지 않음).

| 폴더 | 패키지 · 버전 | 라이선스 | 출처 | 복사한 파일 |
| --- | --- | --- | --- | --- |
| `qrcode-generator/` | qrcode-generator 2.0.4 (Kazuhiko Arase) | MIT | https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz · https://github.com/kazuhikoarase/qrcode-generator | `dist/qrcode.mjs` → `qrcode.mjs` |
| `jsqr/` | jsqr 1.4.0 (Cosmo Wolfe 외) | Apache-2.0 | https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz · https://github.com/cozmo/jsQR | `dist/jsQR.js` → `jsQR.js`, `LICENSE` |
| `pretendard/` | pretendard 1.3.9 (길형진, orioncactus) | SIL OFL 1.1 | https://registry.npmjs.org/pretendard/-/pretendard-1.3.9.tgz · https://github.com/orioncactus/pretendard | `dist/web/variable/pretendardvariable-dynamic-subset.css`, `dist/web/variable/woff2-dynamic-subset/*.woff2` (92개), `dist/LICENSE.txt` |

- qrcode-generator npm 패키지에는 LICENSE 파일이 없어서, 저장소의
  [LICENSE](https://github.com/kazuhikoarase/qrcode-generator/blob/master/LICENSE)
  (MIT, Copyright (c) 2009 Kazuhiko Arase)를 `qrcode-generator/LICENSE`로 넣었습니다.
  소스 파일 머리말에도 같은 MIT 고지가 있습니다.
- Pretendard CSS의 글꼴 경로는 원래부터 상대 경로(`./woff2-dynamic-subset/…`)라 그대로 둡니다.
  브라우저는 `unicode-range`에 맞는 조각만 내려받습니다.
- 사용하는 곳: `public/js/qr.js` (QR 만들기·읽기 — 필요할 때만 불러옴), `index.html`의 글꼴 `<link>`.

## SHA-256

```
ea91d7118a5395289170da848b7c6758b996163bfbccf312591ab65a4911b7c0  qrcode-generator/qrcode.mjs
bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859  jsqr/jsQR.js
```

## 업데이트 방법

```sh
mkdir -p /tmp/vendor-update/pkg && cd /tmp/vendor-update/pkg
npm pack qrcode-generator@<버전> jsqr@<버전> pretendard@<버전> --ignore-scripts
# 각각 빈 폴더에 풀고 위 표의 파일만 복사한 뒤, 이 README의 버전과 해시를 고친다
```
