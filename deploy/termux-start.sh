#!/data/data/com.termux/files/usr/bin/bash
# 안드로이드 Termux에서 미아트스쿨 서버 실행 (Ubuntu/PRoot 없이 Termux만 사용)
#   bash deploy/termux-start.sh
# 외부(인터넷)에서 접속하려면 다른 Termux 창에서:
#   pkg install cloudflared && cloudflared tunnel --url http://localhost:3000
set -e
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  pkg install -y nodejs
fi
node -e "const [a,b]=process.versions.node.split('.').map(Number); if (a<22||(a===22&&b<5)) { console.error('Node.js 22.5 이상이 필요해요: pkg upgrade nodejs'); process.exit(1) }"

[ -d node_modules ] || npm ci --omit=dev

if [ ! -f .env ]; then
  pw=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))")
  cat > .env <<EOT
PORT=3000
NODE_ENV=production
ADMIN_EMAIL=admin@miart.school
ADMIN_PASSWORD=$pw
# cloudflared 등 HTTPS 주소로만 접속할 때 true (같은 와이파이에서 http:// 로 접속하려면 false)
COOKIE_SECURE=true
EOT
  echo "관리자 계정: admin@miart.school / $pw  (.env 파일에 저장됨)"
fi

# 화면이 꺼져도 서버가 멈추지 않게
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true
exec node --disable-warning=ExperimentalWarning server/index.js
