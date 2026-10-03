#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STEP="Khởi tạo"
trap 'code=$?; printf "\n✖ Thất bại tại bước: %s (mã %s)\n" "$STEP" "$code"; exit "$code"' ERR

section() {
	STEP="$1"
	printf "\n▶ %s\n" "$STEP"
}

if [[ "${1:-}" != "DEPLOY CODE" ]]; then
	printf "Cần xác nhận bằng cách nhập DEPLOY CODE. Đã dừng, chưa thực hiện thao tác nào.\n" >&2
	exit 2
fi

printf "\n=== BUILD CODE · DEPLOY VERCEL PRODUCTION (KHÔNG BACKUP DB, KHÔNG COMMIT/PUSH) ===\n"

section "Xác thực tài khoản Vercel"
if ! npx vercel whoami; then
	printf "Chưa đăng nhập. Vercel CLI sẽ yêu cầu bạn xác thực trong terminal/trình duyệt.\n"
	npx vercel login
	npx vercel whoami
fi

section "Build kiểm tra"
npm run build

section "Deploy code hiện tại lên Vercel Production"
npx vercel --prod

printf "\n✓ Build và deploy hoàn tất. Không backup DB, không commit/push.\n"
