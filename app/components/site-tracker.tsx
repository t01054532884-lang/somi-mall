'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// 쿠키 없이 브라우저별 임의 ID만 쓰는 방문 기록. 관리자 화면 방문은 서버에서 제외한다.
function randomId(key: string, store: Storage) {
  try {
    let value = store.getItem(key);
    if (!value) {
      value = Math.random().toString(36).slice(2) + Date.now().toString(36);
      store.setItem(key, value);
    }
    return value;
  } catch {
    return '';
  }
}

export function track(type: 'pageview' | 'add_to_cart' | 'checkout' | 'purchase', extra: Record<string, string> = {}) {
  const params = new URLSearchParams(location.search);
  const body = JSON.stringify({
    type,
    path: location.pathname,
    referrer: document.referrer,
    utm_source: params.get('utm_source') ?? '',
    visitor_id: randomId('choosec_vid', window.localStorage),
    session_id: randomId('choosec_sid', window.sessionStorage),
    ...extra,
  });
  if (navigator.sendBeacon?.('/api/collect', new Blob([body], { type: 'text/plain' }))) return;
  void fetch('/api/collect', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } });
}

export default function SiteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    (window as unknown as { chooseTrack: typeof track }).chooseTrack = track;
  }, []);
  useEffect(() => {
    if (!pathname.startsWith('/admin')) track('pageview');
  }, [pathname]);
  return null;
}
