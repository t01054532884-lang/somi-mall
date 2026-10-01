# CHOOSE-C 진행 현황

마지막 업데이트: 2026-10-01

## 서비스 구성

| 주소 | 서버 | 역할 | 상태 |
|---|---|---|---|
| `choose-c.com`, `www.choose-c.com` | Cloudflare Workers (`shop`) + D1 + R2 | 메인 쇼핑몰 | 배포됨 |
| `choose-c.com/admin` | 같은 Worker | 상품 등록, 주문·리뷰·문의 관리 | 배포됨 |
| `traffic.choose-c.com` (예정) | AWS EC2 서울 리전 | 매출·방문 분석, 재고 발주, 도매가 추적 | 코드 완료, 서버 미설치 |

## 업데이트 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-01 | 아이디·비밀번호 회원가입·로그인 (PBKDF2, 5회 실패 시 10분 잠금) |
| 2026-10-01 | CHOOSE-C 리브랜딩, choose-c.com 커스텀 도메인으로 Cloudflare 배포 |
| 2026-09-30 | OpenAI Sites → Cloudflare Workers 이전 준비 (`wrangler.jsonc`), ChatGPT 헤더 인증 제거(보안), 카카오 인증 이메일만 인정, 네이버 로그인 추가, traffic 연동 주소(`/api/traffic/export`), AWS 설치 스크립트 |
| 2026-09-30 | `traffic/` 운영 대시보드 추가 (Python + SQLite, 테스트 18개) |
| 2026-09-08 ~ 09-11 | 쇼핑몰 기본 기능: 카탈로그·컬렉션, 상품 상세·리뷰·사이즈, 쿠폰·장바구니·주문, 재고, 카카오·구글 로그인, 관리자 화면 |

## 해야 할 일

### traffic 서버 (AWS)
- [ ] EC2 생성: 서울 리전(ap-northeast-2), Ubuntu 24.04, 프리 티어 대상 인스턴스, 탄력적 IP 연결
- [ ] 보안 그룹 22, 80, 443 열기
- [ ] Cloudflare DNS에 `traffic` A 레코드 → EC2 탄력적 IP (프록시 끔, 회색 구름)
- [ ] 서버에서 설치:
      `curl -fsSL https://raw.githubusercontent.com/t01054532884-lang/somi-mall/main/traffic/deploy/aws-setup.sh | sudo DOMAIN=traffic.choose-c.com bash`
- [ ] AWS Billing → Free Tier에서 무료 조건 확인

### 쇼핑몰 ↔ traffic 연결
- [ ] Worker 비밀 값 `TRAFFIC_EXPORT_TOKEN` 등록
- [ ] 서버 `/etc/somi-traffic.env`: `MALL_EXPORT_URL=https://choose-c.com/api/traffic/export`, `MALL_EXPORT_TOKEN`, `ALLOWED_ORIGINS=https://choose-c.com,https://www.choose-c.com`
- [ ] `app/layout.tsx`에 `<script src="https://traffic.choose-c.com/t.js" defer></script>` 추가

### 로그인·운영
- [ ] 카카오·네이버·구글 콘솔에 콜백 주소 등록: `https://choose-c.com/api/auth/{kakao|naver|google}/callback`
- [ ] 네이버 로그인 실제 테스트
- [ ] 결제 연동 (현재 주문은 "결제수단 미연결")
- [ ] 개인정보처리방침에 방문 통계 수집 항목 추가
- [ ] 기존 타입 오류 2개 정리 (`app/admin/login-form.tsx`, `db/products.ts`)
- [ ] 재고 발주 추천: 품절이면 입고가 빠른 도매처를 우선하는 규칙 추가

## 다음 아이디어: 여러 쇼핑몰 옷 가상 피팅

블레이저 같은 카테고리를 누르면 여러 쇼핑몰의 상품이 뜨고, 상품을 누르면 내 사진(또는 3D 아바타)에 입혀 보는 기능.
가격 비교 + 제휴 수수료 모델과 붙이면 "입어 보고 → 마음에 들면 해당 쇼핑몰로 구매" 흐름이 된다.
검토할 것: 다른 쇼핑몰 상품 이미지 사용 권한(제휴 피드 기반), 피팅 생성 비용, 사용자 신체 사진 개인정보 처리, 사이즈 정확도.
