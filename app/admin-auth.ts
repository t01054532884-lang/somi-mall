import { env } from 'cloudflare:workers';
import { getChatGPTUser, type ChatGPTUser } from './chatgpt-auth';

type AdminEnvironment = {
  ADMIN_USER_ID?: string;
  ADMIN_EMAIL?: string;
};

export async function getAdminUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user) return null;

  const runtime = env as unknown as AdminEnvironment;
  const adminId = runtime.ADMIN_USER_ID ?? process.env.ADMIN_USER_ID;
  const adminEmail = runtime.ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const idMatches = Boolean(adminId && user.userId === adminId);
  const emailMatches = Boolean(
    adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase(),
  );

  return idMatches || emailMatches ? user : null;
}

export async function requireAdminRequest(request: Request) {
  const user = await getAdminUser();
  if (!user) return null;

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) return null;
  return user;
}
