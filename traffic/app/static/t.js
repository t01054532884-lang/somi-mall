/* 소미몰 방문 추적. 쿠키 없이 브라우저별 임의 ID만 사용한다. */
(() => {
  const script = document.currentScript;
  const endpoint = (script && script.src ? new URL(script.src).origin : '') + '/collect';

  const randomId = (key, store) => {
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
  };

  const send = (type, extra = {}) => {
    const params = new URLSearchParams(location.search);
    const body = JSON.stringify({
      type,
      path: location.pathname,
      host: location.host,
      referrer: document.referrer,
      utm_source: params.get('utm_source') || '',
      visitor_id: randomId('somi_vid', window.localStorage),
      session_id: randomId('somi_sid', window.sessionStorage),
      ...extra,
    });
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    fetch(endpoint, { method: 'POST', body, mode: 'no-cors', keepalive: true, headers: { 'content-type': 'text/plain' } });
  };

  window.somiTrack = send;

  // 페이지 새로고침 없이 이동하는 화면 전환도 조회로 센다.
  let lastPath = location.pathname;
  const onNavigate = () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      send('pageview');
    }
  };
  const pushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    pushState(...args);
    setTimeout(onNavigate, 0);
  };
  window.addEventListener('popstate', onNavigate);

  send('pageview');
})();
