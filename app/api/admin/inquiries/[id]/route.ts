import { requireAdminRequest } from '@/app/admin-auth';
import { getD1 } from '@/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminRequest(request))) {
    return new Response('관리자만 문의를 관리할 수 있습니다.', { status: 403 });
  }
  const { id } = await context.params;
  const form = await request.formData();
  try {
    if (form.get('_action') === 'delete') {
      await getD1().prepare('DELETE FROM product_inquiries WHERE id = ?').bind(id).run();
      return redirect(request, 'inquiry_deleted');
    }
    const rawAnswer = form.get('answer');
    const answer = typeof rawAnswer === 'string' ? rawAnswer.trim() : '';
    if (answer.length < 2 || answer.length > 1000) throw new Error('Invalid answer.');
    await getD1().prepare('UPDATE product_inquiries SET answer = ? WHERE id = ?').bind(answer, id).run();
    return redirect(request, 'inquiry_answered');
  } catch (error) {
    console.error('Inquiry moderation failed', error);
    return redirect(request, 'error');
  }
}

function redirect(request: Request, status: string) {
  const url = new URL('/admin', request.url);
  url.searchParams.set('status', status);
  url.hash = 'inquiries';
  return Response.redirect(url, 303);
}
