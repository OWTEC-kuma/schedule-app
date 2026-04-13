import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUsername, requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        project_name,
        client_name,
        deliveries,
        children,
        version,
        locked_by,
        lock_expires_at,
        created_at,
        updated_at
      FROM projects
      WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const username = getSessionUsername(request);
  if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { projectName, clientName = '', deliveries = [], children = [], version, lockToken } = body ?? {};

    if (!projectName || typeof version !== 'number' || !lockToken) {
      return NextResponse.json(
        { error: 'projectName, version, and lockToken are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE projects
      SET
        project_name = $1,
        client_name = $2,
        deliveries = $3::jsonb,
        children = $4::jsonb,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $5
        AND lock_token = $6
        AND locked_by = $7
        AND lock_expires_at > NOW()
        AND version = $8
      RETURNING *
      `,
      [projectName, clientName, JSON.stringify(deliveries), JSON.stringify(children), id, lockToken, username, version]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Save failed. Lock expired, version changed, or lock owner mismatch.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const username = getSessionUsername(request);
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
      DELETE FROM projects
      WHERE id = $1
        AND lock_token = $2
        AND locked_by = $3
        AND lock_expires_at > NOW()
      RETURNING id
      `,
      [id, lockToken, username]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
