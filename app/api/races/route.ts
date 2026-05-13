import { NextResponse } from 'next/server';
import { query, isPostgresAvailable } from '@/lib/db/postgres';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get tenant from middleware-injected header
    const tenant = request.headers.get('x-tenant');
    
    console.log('[races] Fetching races for tenant:', tenant);
    
    if (!tenant) {
      console.error('[races] No tenant found in request headers');
      return NextResponse.json(
        { error: 'Tenant not found', races: [] },
        { status: 400 }
      );
    }

    // Check if PostgreSQL is available
    const postgresAvailable = await isPostgresAvailable();
    
    if (!postgresAvailable) {
      console.error('[races] PostgreSQL not configured');
      return NextResponse.json(
        {
          error: 'Database not configured. Please set POSTGRES_URL environment variable.',
          races: [],
          hint: 'Configure PostgreSQL connection in Vercel dashboard'
        },
        { status: 500 }
      );
    }

    // Get races from PostgreSQL, excluding races with "copy" in the name
    const result = await query(`
      SELECT race_id as id, race_name as name, race_date as date
      FROM races
      WHERE tenant_id = $1
        AND LOWER(race_name) NOT LIKE '%copy%'
      ORDER BY race_date DESC
    `, [tenant]);

    const races = result.rows;

    if (races.length === 0) {
      return NextResponse.json(
        {
          error: 'No races found. Please upload a database file first.',
          races: [],
          hint: 'Upload a .db file using the upload button'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      races,
      count: races.length
    });

  } catch (error) {
    console.error('[races] Database error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        races: []
      },
      { status: 500 }
    );
  }
}

// Made with Bob
