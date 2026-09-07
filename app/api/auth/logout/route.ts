import { clearSessionCookie } from '@/app/google-auth';

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) {
    return new Response('Invalid origin', { status: 403 });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: requestUrl.origin,
      'Set-Cookie': clearSessionCookie(requestUrl.protocol === 'https:'),
    },
  });
}
