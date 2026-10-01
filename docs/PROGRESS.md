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

## 다음 기능: 여러 쇼핑몰 옷 가상 피팅

블레이저 같은 카테고리를 누르면 여러 쇼핑몰의 상품이 뜨고, 상품을 누르면 AI 아바타에 입혀 보는 기능.
"입어 보고 → 마음에 들면 해당 쇼핑몰로 구매" 흐름으로 제휴 수수료를 받는다.

### 확정한 방향 (2026-10-01)

| 항목 | 결정 |
|---|---|
| 피팅 대상 | ① CHOOSE-C 자체 상품 ② 쿠팡 파트너스 상품 ③ 제휴 없는 쇼핑몰은 사용자가 링크를 붙여 넣으면 그 사용자에게만 결과 표시 (공개 목록에 올리지 않음) |
| 이미지 권한 | 자체 상품은 소유, 쿠팡 파트너스는 제휴 조건 안에서 사용, 링크 붙여넣기는 개인 이용. 쇼핑몰이 커지면 다른 쇼핑몰·브랜드와 직접 제휴 |
| 사용자 사진 | 받지 않음. 프리셋 AI 얼굴형·체형·키·피부톤 중에서 선택 |
| 요금 | 회원가입 후 3회 무료, 이후 월 구독. 주 수입은 제휴 수수료로 보고 구독은 고급 기능 중심 |
| 비용 절감 | 아바타가 정해진 조합이므로 "상품 × 아바타" 결과를 캐시해 재사용, 인기 상품은 미리 생성 |

### 할 일
- [ ] 쿠팡 파트너스 가입·승인, 상품 API 사용 조건 확인
- [ ] 제휴 링크 옆에 쿠팡 파트너스 수수료 고지 문구 표시
- [ ] 쇼핑몰 삭제 요청 창구와 정책 공개
- [ ] 아바타 구성 확정 (얼굴형·체형·키·피부톤 조합 수)
- [ ] 피팅용 AI 모델 선정과 1회 생성 비용 측정
- [ ] MVP: CHOOSE-C 자체 상품 + 프리셋 아바타 피팅
- [ ] 정식 오픈 전 IT 전문 변호사 검토
