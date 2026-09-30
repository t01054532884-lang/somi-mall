# somi-mall

소미몰 쇼핑몰 (vinext + Cloudflare Workers, D1 데이터베이스, R2 이미지 저장소)과
운영 대시보드 [`traffic/`](traffic/README.md) (Python, AWS EC2).

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
`KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TRAFFIC_EXPORT_TOKEN`

```bash
npx wrangler secret put AUTH_SECRET
```

배포:

```bash
pnpm build
npx wrangler deploy --config dist/server/wrangler.json
```

새 마이그레이션(`drizzle/`)을 추가하면 배포 전에 `npx wrangler d1 migrations apply somimall-db --remote`를 실행합니다.

## 소셜 로그인 콜백 주소

각 개발자 콘솔에 쇼핑몰 주소 기준으로 등록합니다.

- 카카오: `https://<쇼핑몰주소>/api/auth/kakao/callback`
- 네이버: `https://<쇼핑몰주소>/api/auth/naver/callback`
- Google: `https://<쇼핑몰주소>/api/auth/google/callback`
