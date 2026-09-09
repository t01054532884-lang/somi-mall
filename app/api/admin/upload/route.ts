import { env } from 'cloudflare:workers';
import { requireAdminRequest } from '@/app/admin-auth';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXTENSIONS: Record<string, string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};

export async function POST(request: Request) {
  if (!(await requireAdminRequest(request))) return Response.json({error:'관리자 로그인이 필요합니다.'},{status:403});
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size < 1 || file.size > MAX_BYTES) return Response.json({error:'JPG, PNG, WEBP, GIF 파일만 8MB 이하로 올릴 수 있습니다.'},{status:400});
  const key = `products/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  await env.IMAGES.put(key, await file.arrayBuffer(), {httpMetadata:{contentType:file.type,cacheControl:'public, max-age=31536000, immutable'}});
  const url = new URL('/api/media', request.url);url.searchParams.set('key',key);
  return Response.json({url:url.toString()});
}
