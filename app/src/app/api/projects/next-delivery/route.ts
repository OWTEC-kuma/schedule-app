import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAuthOrApiToken } from '@/lib/auth';

export async function GET(request: Request) {
  const authError = await requireAuthOrApiToken(request);
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
        updated_at,
        COALESCE(
          (
            SELECT MIN((item->>'date')::date)
            FROM jsonb_array_elements(deliveries) AS item
            WHERE (item->>'date') IS NOT NULL
              AND (item->>'date') <> ''
          ),
          DATE '9999-12-31'
        ) AS next_delivery_date
      FROM projects
      WHERE
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(deliveries) AS item
          WHERE (item->>'date') IS NOT NULL
            AND (item->>'date') <> ''
        )
      ORDER BY next_delivery_date ASC, created_at ASC
      LIMIT 20
      `
    );

    const projects = result.rows.map((row) => ({
      id: row.id,
      projectName: row.project_name,
      clientName: row.client_name,
      deliveries: row.deliveries,
      children: row.children,
      version: row.version,
      lockedBy: row.locked_by,
      lockExpiresAt: row.lock_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      nextDeliveryDate:
        row.next_delivery_date && row.next_delivery_date !== '9999-12-31'
          ? row.next_delivery_date.toISOString().slice(0, 10)
          : null,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load next delivery projects' }, { status: 500 });
  }
}
