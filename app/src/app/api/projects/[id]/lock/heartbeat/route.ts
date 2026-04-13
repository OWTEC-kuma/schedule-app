import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type Params = {
  params: Promise<{ id: string }>;
};

function lockIntervalSql() {
  const minutes = Number(process.env.LOCK_MINUTES ?? '5');
  return `${minutes} minutes`;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { lockToken } = body ?? {};

    if (!lockToken) {
      return NextResponse.json({ error: 'lockToken is required' }, { status: 400 });
    }

    const result = await pool.query(
      `
      UPDATE projects
      SET
        lock_expires_at = NOW() + ($3::interval),
        updated_at = NOW()
      WHERE id = $1
        AND lock_token = $2
        AND lock_expires_at > NOW()
      RETURNING id, lock_expires_at
      `,
      [id, lockToken, lockIntervalSql()]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Heartbeat failed' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, lock: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to refresh lock' }, { status: 500 });
  }
}
