import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

type VendorRow = {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
};

function normalizeVendorRow(row: VendorRow) {
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
      FROM vendors
      ORDER BY name ASC, created_at ASC
      `
    );

    return NextResponse.json({ vendors: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load vendors' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const client = await pool.connect();

  try {
    const body = await request.json();
    const incoming: VendorRow[] | null = Array.isArray(body?.vendors)
      ? (body.vendors as VendorRow[])
      : null;

    if (!incoming) {
      return NextResponse.json({ error: 'vendors array is required' }, { status: 400 });
    }

    if (incoming.length === 0) {
      return NextResponse.json(
        { error: 'vendors array must contain at least one vendor' },
        { status: 400 }
      );
    }

    const vendors = incoming
      .map((row: VendorRow) => normalizeVendorRow(row))
      .filter(
        (row: ReturnType<typeof normalizeVendorRow>) =>
          Boolean(row.id && row.name)
      );

    if (vendors.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid vendor with id and name is required' },
        { status: 400 }
      );
    }

    const vendorIds = vendors.map((row) => row.id);

    await client.query('BEGIN');
    await client.query(
      `
      DELETE FROM vendors
      WHERE id <> ALL($1::text[])
      `,
      [vendorIds]
    );

    for (const vendor of vendors) {
      await client.query(
        `
        INSERT INTO vendors (
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
        [vendor.id, vendor.name, vendor.address, vendor.phone]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      ok: true,
      count: vendors.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Failed to save vendors' }, { status: 500 });
  } finally {
    client.release();
  }
}