# somi-mall

CHOOSE-C 쇼핑몰 (구 소미몰). vinext + Cloudflare Workers, D1 데이터베이스, R2 이미지 저장소.
진행 현황과 계획은 [docs/PROGRESS.md](docs/PROGRESS.md)에 있습니다.

## 관리자 화면 (`/admin`)

| 메뉴 | 주소 | 하는 일 |
|---|---|---|
| 상품·주문 관리 | `/admin` | 상품 등록·진열, 주문·배송, 리뷰·문의 |
| 매출·방문 분석 | `/admin/insights` | 매출, 주문, 객단가, 방문자, 구매 전환율, 일별 추이, 인기 상품, 유입 경로, 구매 단계 |
| 재고·발주 | `/admin/inventory` | 판매 속도로 재고 소진일과 발주 추천 수량 계산, 발주 기록, 입고 완료 시 재고 자동 증가, CSV |
| 도매가 추적 | `/admin/wholesale` | KRW·CNY·JPY·USD 도매가를 원화 원가로 환산, 변동률, 최저 원가 도매처, 마진, 6시간마다 자동 확인 |

- 계산 로직: `lib/ops/calc.ts` (테스트: `pnpm test:ops`), DB 조회: `db/ops.ts`, 테이블: `drizzle/0008_operations.sql`
- 방문 기록: `app/components/site-tracker.tsx` → `/api/collect` (브라우저별 임의 ID만 저장, 관리자 화면 제외)
- 정기 실행: `worker/index.ts`의 `scheduled` + `wrangler.jsonc`의 `triggers.crons`

## Cloudflare 배포

처음 한 번:

```bash
pnpm install
npx wrangler login
npx wrangler d1 create somimall-db          # 출력된 database_id를 wrangler.jsonc에 넣기
npx wrangler r2 bucket create somimall-images
npx wrangler d1 migrations apply somimall-db --remote
```

비밀 값 등록 (`.env.example` 참고): `AUTH_SECRET`, `ADMIN_LOGIN_ID`, `ADMIN_LOGIN_PASSWORD`, `ADMIN_SESSION_TOKEN`,
`KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

```bash
npx wrangler secret put AUTH_SECRET
```

배포 (**새 마이그레이션이 있으면 반드시 먼저 적용**):

```bash
npx wrangler d1 migrations apply somimall-db --remote
pnpm build
npx wrangler deploy --config dist/server/wrangler.json
```

새 마이그레이션(`drizzle/`)을 추가하면 배포 전에 `npx wrangler d1 migrations apply somimall-db --remote`를 실행합니다.

## 소셜 로그인 콜백 주소

각 개발자 콘솔에 쇼핑몰 주소 기준으로 등록합니다.

- 카카오: `https://<쇼핑몰주소>/api/auth/kakao/callback`
- 네이버: `https://<쇼핑몰주소>/api/auth/naver/callback`
- Google: `https://<쇼핑몰주소>/api/auth/google/callback`
