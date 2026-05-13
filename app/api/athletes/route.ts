import { NextResponse } from 'next/server';
import { query, isPostgresAvailable } from '@/lib/db/postgres';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('[athletes] Fetching athletes');

    // Check if PostgreSQL is available
    const postgresAvailable = await isPostgresAvailable();
    
    if (!postgresAvailable) {
      console.error('[athletes] PostgreSQL not configured');
      return NextResponse.json(
        {
          error: 'Database not configured. Please set POSTGRES_URL environment variable.',
          athletes: []
        },
        { status: 500 }
      );
    }

    // Get athletes with their statistics from PostgreSQL
    // Only show athletes who have at least one race
    const result = await query(`
      SELECT
        a.athlete_id as id,
        a.bib_number as "bibNumber",
        a.first_name as "firstName",
        a.last_name as "lastName",
        a.gender,
        a.full_name as "fullName",
        COALESCE(s.total_races, 0) as "totalRaces",
        s.first_race_date as "firstRace",
        s.last_race_date as "lastRace"
      FROM athletes a
      LEFT JOIN athlete_stats s ON s.athlete_id = a.athlete_id
      WHERE COALESCE(s.total_races, 0) > 0
      ORDER BY a.last_name ASC, a.first_name ASC
    `);

    const athletes = result.rows;

    return NextResponse.json({
      athletes,
      total: athletes.length
    });

  } catch (error) {
    console.error('[athletes] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', athletes: [] },
      { status: 500 }
    );
  }
}

// Made with Bob