import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { athleteId: string } }
) {
  try {
    // Get tenant from middleware-injected header
    const tenant = request.headers.get('x-tenant');
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 400 }
      );
    }

    const athleteId = parseInt(params.athleteId);
    
    if (isNaN(athleteId)) {
      return NextResponse.json(
        { error: 'Invalid athlete ID' },
        { status: 400 }
      );
    }

    // Get athlete info from PostgreSQL
    const athleteResult = await query(`
      SELECT
        athlete_id as id,
        bib_number,
        first_name,
        last_name,
        gender,
        full_name
      FROM athletes
      WHERE tenant_id = $1 AND athlete_id = $2
    `, [tenant, athleteId]);

    if (athleteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Athlete not found' },
        { status: 404 }
      );
    }

    const athleteInfo = athleteResult.rows[0];

    // Get all races for this athlete from race_results, excluding races with "copy" in name
    const racesResult = await query(`
      SELECT
        rr.race_id,
        r.race_name,
        r.race_date,
        rr.position,
        rr.total_seconds,
        rr.total_time,
        rr.bib_number,
        (SELECT COUNT(*) FROM race_results WHERE tenant_id = $1 AND race_id = rr.race_id) as total_finishers
      FROM race_results rr
      JOIN races r ON r.tenant_id = rr.tenant_id AND r.race_id = rr.race_id
      WHERE rr.tenant_id = $1
        AND rr.athlete_id = $2
        AND LOWER(r.race_name) NOT LIKE '%copy%'
      ORDER BY r.race_date DESC
    `, [tenant, athleteId]);

    const formattedRaces = racesResult.rows.map((race: any) => ({
      raceId: race.race_id,
      raceName: race.race_name,
      raceDate: race.race_date,
      position: race.position,
      totalFinishers: parseInt(race.total_finishers),
      totalTime: race.total_time,
      totalSeconds: parseFloat(race.total_seconds),
      bibNumber: race.bib_number,
      athleteName: athleteInfo.full_name
    }));

    return NextResponse.json({
      athlete: {
        id: athleteInfo.id,
        bibNumber: athleteInfo.bib_number,
        firstName: athleteInfo.first_name,
        lastName: athleteInfo.last_name,
        gender: athleteInfo.gender,
        fullName: athleteInfo.full_name
      },
      races: formattedRaces,
      totalRaces: formattedRaces.length
    });

  } catch (error) {
    console.error('[athlete-races] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Made with Bob