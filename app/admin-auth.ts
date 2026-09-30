import { env } from 'cloudflare:workers';
import { getMemberSession } from './google-auth';
import { cookies } from 'next/headers';

export type AdminUser = {
  userId: string;
  displayName: string;
  email: string;
};

type AdminEnvironment = {
  ADMIN_EMAIL?: string;
  ADMIN_SESSION_TOKEN?: string;
};

export async function getAdminUser(): Promise<AdminUser | null> {
  const runtime = env as unknown as AdminEnvironment;
  const sessionToken = runtime.ADMIN_SESSION_TOKEN ?? process.env.ADMIN_SESSION_TOKEN;
  if (sessionToken && (await cookies()).get('somi_admin')?.value === sessionToken) {
    return { userId: 'password-admin', displayName: '소미몰 운영자', email: 'admin@somimall.local' };
  }

  const adminEmail = runtime.ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const member = await getMemberSession();
  if (member && adminEmail && member.email.toLowerCase() === adminEmail.toLowerCase()) {
    return {
      userId: member.memberId,
      displayName: member.displayName,
      email: member.email,
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
