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
    const { editorName, lockToken } = body ?? {};

    if (!editorName || !lockToken) {
      return NextResponse.json({ error: 'editorName and lockToken are required' }, { status: 400 });
    }

    const result = await pool.query(
      `
      UPDATE projects
      SET
        lock_token = $1,
        locked_by = $2,
        lock_expires_at = NOW() + ($4::interval),
        updated_at = NOW()
      WHERE id = $3
        AND (
          lock_expires_at IS NULL
          OR lock_expires_at < NOW()
          OR lock_token = $1
        )
      RETURNING id, locked_by, lock_expires_at
      `,
      [lockToken, editorName, id, lockIntervalSql()]
    );

    if (result.rowCount === 0) {
      const locked = await pool.query(
        `
        SELECT locked_by, lock_expires_at
        FROM projects
        WHERE id = $1
        `,
        [id]
      );

      return NextResponse.json(
        { error: 'Project is locked', lock: locked.rows[0] ?? null },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, lock: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to acquire lock' }, { status: 500 });
  }
}
