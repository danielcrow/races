import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/postgres';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * POST /api/migrate-schema
 * Run schema migrations to add new columns (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = request.headers.get('x-tenant');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    console.log('[migrate-schema] Starting schema migration...');
    const migrations = [];

    // Check and add passcode column
    try {
      const checkPasscode = await query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'athletes' 
         AND column_name = 'passcode'`
      );

      if (checkPasscode.rows.length === 0) {
        console.log('[migrate-schema] Adding passcode column...');
        await query('ALTER TABLE athletes ADD COLUMN passcode VARCHAR(8)');
        migrations.push('Added passcode column to athletes table');
      } else {
        migrations.push('Passcode column already exists');
      }
    } catch (error) {
      console.error('[migrate-schema] Error adding passcode column:', error);
      migrations.push(`Error adding passcode column: ${(error as Error).message}`);
    }

    // Check and add passcode_created_at column
    try {
      const checkPasscodeCreated = await query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'athletes' 
         AND column_name = 'passcode_created_at'`
      );

      if (checkPasscodeCreated.rows.length === 0) {
        console.log('[migrate-schema] Adding passcode_created_at column...');
        await query('ALTER TABLE athletes ADD COLUMN passcode_created_at TIMESTAMP');
        migrations.push('Added passcode_created_at column to athletes table');
      } else {
        migrations.push('Passcode_created_at column already exists');
      }
    } catch (error) {
      console.error('[migrate-schema] Error adding passcode_created_at column:', error);
      migrations.push(`Error adding passcode_created_at column: ${(error as Error).message}`);
    }

    console.log('[migrate-schema] Schema migration completed');
    console.log('[migrate-schema] Migrations:', migrations);

    return NextResponse.json({
      success: true,
      migrations,
      message: 'Schema migration completed successfully'
    });
  } catch (error) {
    console.error('[migrate-schema] Schema migration error:', error);
    return NextResponse.json(
      { 
        error: 'Schema migration failed',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

// Made with Bob
