import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

type ClientRow = {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
};

function normalizeClientRow(row: ClientRow) {
  return {
    id: String(row.id ?? '').trim(),
    name: String(row.name ?? '').trim(),
    address: String(row.address ?? '').trim(),
    phone: String(row.phone ?? '').trim(),
  };
}

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        address,
        phone,
        created_at,
        updated_at
      FROM clients
      ORDER BY name ASC, created_at ASC
      `
    );

    return NextResponse.json({ clients: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const client = await pool.connect();

  try {
    const body = await request.json();
    const incoming: ClientRow[] | null = Array.isArray(body?.clients)
      ? (body.clients as ClientRow[])
      : null;

    if (!incoming) {
      return NextResponse.json({ error: 'clients array is required' }, { status: 400 });
    }

    if (incoming.length === 0) {
      return NextResponse.json(
        { error: 'clients array must contain at least one client' },
        { status: 400 }
      );
    }

    const clients = incoming
      .map((row: ClientRow) => normalizeClientRow(row))
      .filter((row) => Boolean(row.id && row.name));

    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid client with id and name is required' },
        { status: 400 }
      );
    }

    const clientIds = clients.map((row) => row.id);

    await client.query('BEGIN');
    await client.query(
      `
      DELETE FROM clients
      WHERE id <> ALL($1::text[])
      `,
      [clientIds]
    );

    for (const clientRow of clients) {
      await client.query(
        `
        INSERT INTO clients (
          id,
          name,
          address,
          phone,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          updated_at = NOW()
        `,
        [clientRow.id, clientRow.name, clientRow.address, clientRow.phone]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ ok: true, count: clients.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Failed to save clients' }, { status: 500 });
  } finally {
    client.release();
  }
}
