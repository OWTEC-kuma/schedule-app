import { NextResponse } from 'next/server';
import { createLoginResponse, validateCredentials } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    return createLoginResponse(username);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
