import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUsername, requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const username = await getSessionUsername(request);
  if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        lock_token = NULL,
        locked_by = NULL,
        lock_expires_at = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND lock_token = $2
        AND locked_by = $3
      `,
      [id, lockToken, username]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Release failed. Lock owner mismatch or no active lock.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to release lock' }, { status: 500 });
  }
}
