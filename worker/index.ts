// Cloudflare Worker 진입점: 페이지 요청은 vinext에 넘기고, 정기 실행(Cron)에서는 도매가를 자동 확인한다.
import handler from 'vinext/server/fetch-handler';
import { refreshAllPrices } from '../db/ops';

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      refreshAllPrices()
        .then(({ ok, failed }) => console.log(`도매가 자동 확인: 성공 ${ok}, 실패 ${failed}`))
        .catch((error) => console.error('도매가 자동 확인 실패', error)),
    );
  },
};
