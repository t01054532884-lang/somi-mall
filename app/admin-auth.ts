import { env } from 'cloudflare:workers';
import { getChatGPTUser, type ChatGPTUser } from './chatgpt-auth';
import { getMemberSession } from './google-auth';
import { cookies } from 'next/headers';

type AdminEnvironment = {
  ADMIN_USER_ID?: string;
  ADMIN_EMAIL?: string;
  ADMIN_SESSION_TOKEN?: string;
};

export async function getAdminUser(): Promise<ChatGPTUser | null> {
  const runtime = env as unknown as AdminEnvironment;
  const sessionToken = runtime.ADMIN_SESSION_TOKEN ?? process.env.ADMIN_SESSION_TOKEN;
  if (sessionToken && (await cookies()).get('somi_admin')?.value === sessionToken) {
    return { userId: 'password-admin', displayName: '소미몰 운영자', email: 'admin@somimall.local', fullName: '소미몰 운영자' };
  }
  const adminId = runtime.ADMIN_USER_ID ?? process.env.ADMIN_USER_ID;
  const adminEmail = runtime.ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const chatGPTUser = await getChatGPTUser();
  if (chatGPTUser) {
    const idMatches = Boolean(adminId && chatGPTUser.userId === adminId);
    const emailMatches = Boolean(
      adminEmail && chatGPTUser.email.toLowerCase() === adminEmail.toLowerCase(),
    );
    if (idMatches || emailMatches) return chatGPTUser;
  }

  const member = await getMemberSession();
  if (member && adminEmail && member.email.toLowerCase() === adminEmail.toLowerCase()) {
    return {
      userId: member.memberId,
      displayName: member.displayName,
      email: member.email,
      fullName: member.displayName,
    };
  }
  return null;
}

export async function requireAdminRequest(request: Request) {
  const user = await getAdminUser();
  if (!user) return null;

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) return null;
  return user;
}
