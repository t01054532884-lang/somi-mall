import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminRequest(request))) {
    return new Response('관리자만 리뷰를 관리할 수 있습니다.', { status: 403 });
  }
  const { id } = await context.params;
  const form = await request.formData();
  try {
    if (form.get('_action') === 'delete') {
      await getD1().prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
      return redirect(request, 'review_deleted');
    }
    const rawReply = form.get('reply');
    const reply = typeof rawReply === 'string' ? rawReply.trim() : '';
    if (reply.length > 1000) throw new Error('Reply is too long.');
    await getD1().prepare('UPDATE reviews SET admin_reply = ? WHERE id = ?').bind(reply, id).run();
    return redirect(request, 'review_replied');
  } catch (error) {
    console.error('Review moderation failed', error);
    return redirect(request, 'error');
  }
}

function redirect(request: Request, status: string) {
  const url = new URL('/admin', request.url);
  url.searchParams.set('status', status);
  url.hash = 'reviews';
  return Response.redirect(url, 303);
}
