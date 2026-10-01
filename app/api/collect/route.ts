import { recordEvent } from '@/db/ops';
import { cleanId, referrerHost } from '@/lib/ops/calc';

const EVENT_TYPES = new Set(['pageview', 'add_to_cart', 'checkout', 'purchase']);
const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/** 쇼핑몰 방문 기록. 개인정보 없이 브라우저별 임의 ID만 받는다. 관리자 페이지 방문은 세지 않는다. */
export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) return new Response(null, { status: 403 });
  const userAgent = request.headers.get('user-agent') ?? '';
  const body = await request.text();
  if (body.length > 4000 || BOT_UA.test(userAgent)) return new Response(null, { status: 204 });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const type = String(data.type ?? '');
  const path = String(data.path ?? '/').slice(0, 300);
  if (!EVENT_TYPES.has(type) || path.startsWith('/admin')) return new Response(null, { status: type ? 204 : 400 });

  const productMatch = /^\/product\/([^/?#]+)/.exec(path);
  try {
    await recordEvent({
      type,
      path,
      productId: cleanId(data.product_id, 80) || (productMatch ? cleanId(decodeURIComponent(productMatch[1]), 80) : '') || null,
      referrer: referrerHost(String(data.referrer ?? ''), requestUrl.hostname),
      utmSource: cleanId(data.utm_source, 60),
      device: /Mobi|Android|iPhone/.test(userAgent) ? 'mobile' : 'desktop',
      visitorId: cleanId(data.visitor_id, 40),
      sessionId: cleanId(data.session_id, 40),
    });
  } catch (error) {
    console.error('Visit record failed', error);
  }
  return new Response(null, { status: 204 });
}
