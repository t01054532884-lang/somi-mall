# 쇼핑몰 연동 방법

트래픽 대시보드가 쇼핑몰 데이터를 받으려면 쇼핑몰 쪽에 두 가지를 추가합니다.
둘 다 선택 사항입니다. 추가하지 않아도 관리자 화면의 **주문 CSV 내보내기** 파일을 대시보드에 올려서 쓸 수 있습니다.

## 1. 상품·재고·주문 자동 동기화

1. `route.ts.example`을 쇼핑몰의 `app/api/traffic/export/route.ts`로 복사합니다.
2. 긴 무작위 문자열을 하나 만듭니다. 예: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
3. 쇼핑몰 호스팅의 비밀 설정에 `TRAFFIC_EXPORT_TOKEN`으로 그 값을 저장하고 다시 배포합니다.
4. 트래픽 대시보드(Render)의 환경 변수에 다음을 넣습니다.
   - `MALL_EXPORT_URL` = `https://쇼핑몰주소/api/traffic/export`
   - `MALL_EXPORT_TOKEN` = 2번에서 만든 값
5. 대시보드 **데이터 연동 → 지금 동기화**를 누릅니다.

이 주소는 토큰이 있어야만 열리고, 고객 이름·연락처·주소·이메일은 내보내지 않습니다.

## 2. 방문 추적

`app/layout.tsx`의 `<body>` 안에 스크립트 한 줄을 넣습니다. 주소는 대시보드 **데이터 연동** 화면에 표시된 값을 그대로 쓰세요.

```tsx
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}<script src="https://트래픽주소/t.js" defer></script></body></html>}
```

장바구니 담기와 주문서 진입까지 세려면 해당 동작에서 다음을 호출합니다.

```ts
(window as any).somiTrack?.('add_to_cart', { product_id: product.id });
(window as any).somiTrack?.('checkout');
```

다른 사이트가 가짜 방문을 보내지 못하게 하려면 대시보드 환경 변수 `ALLOWED_ORIGINS`에 쇼핑몰 주소(예: `https://somimall.example`)를 넣으세요.
방문 기록은 브라우저별 임의 ID만 쓰지만, 개인정보처리방침에 "방문 통계 수집" 항목을 추가해 두는 것이 좋습니다.
