# CHOOSE-C 진행 현황

마지막 업데이트: 2026-10-02

## 서비스 구성

| 주소 | 서버 | 역할 | 상태 |
|---|---|---|---|
| `choose-c.com`, `www.choose-c.com` | Cloudflare Workers (`shop`) + D1 + R2 | 메인 쇼핑몰 | 배포됨 |
| `choose-c.com/admin` | 같은 Worker | 상품 등록, 주문·리뷰·문의 관리 + 매출·방문 분석, 재고·발주, 도매가 추적 | 배포됨 (2026-10-02) |
| `fit.choose-c.com` (예정) | Cloudflare Worker `fit` ([fit.choose-c 저장소](https://github.com/t01054532884-lang/fit.choose-c)) | 독립 서비스: 여러 쇼핑몰 상품 AI 가상 피팅·비교 | 기획 |

> 2026-10-01 결정: 별도 traffic 서버(AWS)는 만들지 않는다. traffic 기능은 `choose-c.com/admin`으로 옮겨
> 같은 D1 DB를 직접 쓰고, 고객용 새 사이트는 `fit.choose-c.com`으로 연다.

## 업데이트 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-02 | admin 운영 도구 배포: 마이그레이션 0008 적용, 6시간 Cron 등록 |
| 2026-10-01 | traffic 기능을 admin으로 이전: `/admin/insights`, `/admin/inventory`, `/admin/wholesale`, 방문 기록 `/api/collect`, 6시간마다 도매가 자동 확인(Cron), 입고 완료 시 재고 자동 증가. `/api/traffic/export` 삭제 |
| 2026-10-01 | 계획 변경: traffic 기능은 admin으로 통합, 고객용 피팅 사이트는 `fit.choose-c.com` |
| 2026-10-01 | 아이디·비밀번호 회원가입·로그인 (PBKDF2, 5회 실패 시 10분 잠금) |
| 2026-10-01 | CHOOSE-C 리브랜딩, choose-c.com 커스텀 도메인으로 Cloudflare 배포 |
| 2026-09-30 | OpenAI Sites → Cloudflare Workers 이전 준비 (`wrangler.jsonc`), ChatGPT 헤더 인증 제거(보안), 카카오 인증 이메일만 인정, 네이버 로그인 추가, traffic 연동 주소(`/api/traffic/export`), AWS 설치 스크립트 |
| 2026-09-30 | `traffic/` 운영 대시보드 추가 (Python + SQLite, 테스트 18개) |
| 2026-09-08 ~ 09-11 | 쇼핑몰 기본 기능: 카탈로그·컬렉션, 상품 상세·리뷰·사이즈, 쿠폰·장바구니·주문, 재고, 카카오·구글 로그인, 관리자 화면 |

## 다른 컴퓨터에서 이어서 하기

```bash
git clone https://github.com/t01054532884-lang/somi-mall.git
git clone https://github.com/t01054532884-lang/fit.choose-c.git
cd somi-mall
pnpm install
pnpm test:ops      # 운영 도구 계산 테스트
pnpm build
```

필요한 것: Node.js 22.18 이상(24 권장), pnpm, Cloudflare 로그인(`npx wrangler login`).

## 해야 할 일

### admin 운영 도구 배포 (다음에 할 일)
- [x] 원격 DB에 마이그레이션 적용: `npx wrangler d1 migrations apply somimall-db --remote` (0008_operations) — 2026-10-02
- [x] 배포: `pnpm build` → `npx wrangler deploy --config dist/server/wrangler.json` — 2026-10-02
- [x] Cron(6시간마다) 등록 — 2026-10-02. Cron에는 계정의 workers.dev 서브도메인이 필요해서 `choose-c`로 등록함 (쇼핑몰 Worker는 `workers_dev: false`라 그 주소로 열리지 않음)
- [ ] `choose-c.com/admin/insights`, `/admin/inventory`, `/admin/wholesale` 화면 확인 (관리자 로그인 필요)
- [ ] 도매처·도매 상품 등록, 환율 실제 값으로 변경
- 완료: D1 테이블, 3개 메뉴, 방문 기록, Cron 처리기, 발주 CSV, 계산 테스트 8개, SQL 쿼리 44개 검증

### fit.choose-c.com (독립 서비스, 2026-10-01 결정)
쇼핑몰과 별개 서비스로 키운다. 피팅 사이트가 모은 고객이 CHOOSE-C 쇼핑몰 성장에도 도움이 되는 구조.

| 항목 | 결정 |
|---|---|
| 코드 | 새 GitHub 저장소 (이 저장소와 분리) |
| 서버 | 같은 Cloudflare 계정의 별도 Worker `fit` + 전용 D1(회원·구독·피팅 기록) + 전용 R2(피팅 결과 이미지) |
| AI 피팅 생성 | 초기에는 외부 AI API 호출(쓴 만큼 비용). 이용량이 커져 API 비용이 더 비싸지면 GPU 서버(AWS 등) 검토 |
| 회원 | 쇼핑몰과 분리된 자체 회원 |
| CHOOSE-C 상품 | 다른 제휴 쇼핑몰처럼 상품 피드로 연결 |

- [x] 새 저장소 생성: https://github.com/t01054532884-lang/fit.choose-c
- [ ] Cloudflare DNS와 Worker 라우트 연결
- [ ] 아래 "다음 기능: 가상 피팅" 계획대로 MVP 개발

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
