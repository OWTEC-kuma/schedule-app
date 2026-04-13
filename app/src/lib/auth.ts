import crypto from 'crypto';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'owtec_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24; // 1 day
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET ?? 'owtec-default-session-secret';
const AUTH_USERNAME = process.env.AUTH_USERNAME ?? 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'admin';
const AUTH_SESSION_MAX_AGE = Number(process.env.AUTH_SESSION_MAX_AGE ?? DEFAULT_MAX_AGE);

function createHmac(value: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function createSessionToken(username: string) {
  const expires = Date.now() + AUTH_SESSION_MAX_AGE * 1000;
  const payload = `${username}|${expires}`;
  const signature = createHmac(payload);
  const encoded = Buffer.from(payload, 'utf8').toString('base64');
  return `${encoded}|${signature}`;
}

function verifySessionToken(token: string) {
  const separatorIndex = token.lastIndexOf('|');
  if (separatorIndex === -1) return null;

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const payload = Buffer.from(encodedPayload, 'base64').toString('utf8');
  if (createHmac(payload) !== signature) return null;

  const [username, expiresRaw] = payload.split('|');
  if (!username || !expiresRaw) return null;
  const expires = Number(expiresRaw);
  if (Number.isNaN(expires) || Date.now() > expires) return null;

  return { username, expires };
}

export function getSessionUsername(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = verifySessionToken(token);
  return session?.username ?? null;
}

export function requireAuth(request: Request): NextResponse | null {
  if (!getSessionUsername(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function createLoginResponse(username: string) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_SESSION_MAX_AGE,
    sameSite: 'lax',
  });
  return response;
}

export function createLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
  });
  return response;
}

export function validateCredentials(username: string, password: string) {
  return username === AUTH_USERNAME && password === AUTH_PASSWORD;
}
