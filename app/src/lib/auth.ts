import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'owtec_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24; // 1 day
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET ?? 'owtec-default-session-secret';
const AUTH_USERNAME = process.env.AUTH_USERNAME ?? 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'admin';
const AUTH_SESSION_MAX_AGE = Number(process.env.AUTH_SESSION_MAX_AGE ?? DEFAULT_MAX_AGE);
const AUTH_SESSION_SECURE = typeof process.env.AUTH_SESSION_SECURE !== 'undefined'
  ? process.env.AUTH_SESSION_SECURE.toLowerCase() === 'true'
  : process.env.NODE_ENV === 'production';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let sessionKeyPromise: Promise<CryptoKey> | null = null;

function utf8ToBytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSessionKey(): Promise<CryptoKey> {
  if (!sessionKeyPromise) {
    const secretBytes = utf8ToBytes(SESSION_SECRET);
    sessionKeyPromise = crypto.subtle.importKey(
      'raw',
      secretBytes.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  return sessionKeyPromise;
}

async function createHmac(value: string) {
  const key = await getSessionKey();
  const signature = await crypto.subtle.sign('HMAC', key, utf8ToBytes(value).buffer as ArrayBuffer);
  return bytesToHex(signature);
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

async function createSessionToken(username: string) {
  const expires = Date.now() + AUTH_SESSION_MAX_AGE * 1000;
  const payload = `${username}|${expires}`;
  const signature = await createHmac(payload);
  const encoded = base64Encode(utf8ToBytes(payload));
  return `${encoded}|${signature}`;
}

async function verifySessionToken(token: string) {
  const separatorIndex = token.lastIndexOf('|');
  if (separatorIndex === -1) return null;

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const payload = textDecoder.decode(base64Decode(encodedPayload));
  if ((await createHmac(payload)) !== signature) return null;

  const [username, expiresRaw] = payload.split('|');
  if (!username || !expiresRaw) return null;

  const expires = Number(expiresRaw);
  if (Number.isNaN(expires) || Date.now() > expires) return null;

  return { username, expires };
}

export async function getSessionUsername(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const session = await verifySessionToken(token);
  return session?.username ?? null;
}

export function getBearerToken(request: Request): string {
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

export function isValidApiToken(request: Request): boolean {
  const token = getBearerToken(request);
  const validTokens = [process.env.LINE_API_TOKEN, process.env.INTERNAL_API_TOKEN].filter(Boolean);
  return Boolean(token && validTokens.includes(token));
}

export async function requireAuth(request: Request): Promise<NextResponse | null> {
  if (!(await getSessionUsername(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function requireAuthOrApiToken(request: Request): Promise<NextResponse | null> {
  if (await getSessionUsername(request)) {
    return null;
  }

  if (isValidApiToken(request)) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function createLoginResponse(username: string) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(username), {
    httpOnly: true,
    secure: AUTH_SESSION_SECURE,
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
    secure: AUTH_SESSION_SECURE,
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
  });
  return response;
}

export function validateCredentials(username: string, password: string) {
  return username === AUTH_USERNAME && password === AUTH_PASSWORD;
}
