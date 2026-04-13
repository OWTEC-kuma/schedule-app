import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { lockToken } = body ?? {};

    if (!lockToken) {
      return NextResponse.json({ error: 'lockToken is required' }, { status: 400 });
    }

    await pool.query(
      `
      UPDATE projects
      SET
        lock_token = NULL,
        locked_by = NULL,
        lock_expires_at = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND lock_token = $2
      `,
      [id, lockToken]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to release lock' }, { status: 500 });
  }
}
