import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
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
      ORDER BY
        COALESCE(
          (
            SELECT MIN((item->>'date')::date)
            FROM jsonb_array_elements(deliveries) AS item
            WHERE (item->>'date') IS NOT NULL
              AND (item->>'date') <> ''
          ),
          DATE '9999-12-31'
        ) ASC,
        created_at ASC
      `
    );

    return NextResponse.json({ projects: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, projectName, clientName = '', deliveries = [], children = [] } = body ?? {};

    if (!id || !projectName) {
      return NextResponse.json({ error: 'id and projectName are required' }, { status: 400 });
    }

    const result = await pool.query(
      `
      INSERT INTO projects (
        id,
        project_name,
        client_name,
        deliveries,
        children
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      RETURNING *
      `,
      [id, projectName, clientName, JSON.stringify(deliveries), JSON.stringify(children)]
    );

    return NextResponse.json({ project: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
