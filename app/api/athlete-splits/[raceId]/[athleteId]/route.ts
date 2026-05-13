import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { raceId: string; athleteId: string } }
) {
  try {
    const raceId = parseInt(params.raceId);
    const athleteId = parseInt(params.athleteId);
    
    if (isNaN(raceId) || isNaN(athleteId)) {
      return NextResponse.json(
        { error: 'Invalid race or athlete ID' },
        { status: 400 }
      );
    }

    // Get race info
    const raceResult = await query(`
      SELECT race_id as id, race_name as name, race_date as date
      FROM races
      WHERE race_id = $1
    `, [raceId]);

    if (raceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Race not found' },
        { status: 404 }
      );
    }

    const raceInfo = raceResult.rows[0];

    // Get athlete info and their result for this race
    const athleteResult = await query(`
      SELECT
        a.athlete_id as id,
        a.bib_number,
        a.first_name,
        a.last_name,
        a.gender,
        rr.position,
        rr.total_time,
        rr.total_seconds,
        rr.splits
      FROM athletes a
      LEFT JOIN race_results rr ON rr.race_id = $1
        AND rr.athlete_id = a.athlete_id
      WHERE a.athlete_id = $2
    `, [raceId, athleteId]);

    if (athleteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Athlete not found' },
        { status: 404 }
      );
    }

    const athleteInfo = athleteResult.rows[0];
    // splits might already be an object if PostgreSQL returns JSONB as object
    const athleteSplits = typeof athleteInfo.splits === 'string'
      ? JSON.parse(athleteInfo.splits)
      : (athleteInfo.splits || {});

    // Get split statistics for this race
    const splitStatsResult = await query(`
      SELECT
        split_description,
        AVG(split_seconds) as avg_seconds,
        MIN(split_seconds) as min_seconds,
        MAX(split_seconds) as max_seconds
      FROM splits
      WHERE race_id = $1
      GROUP BY split_description
      ORDER BY MIN(split_datetime)
    `, [raceId]);

    // Combine athlete splits with statistics
    const splitsWithStats = Object.entries(athleteSplits).map(([splitName, splitData]: [string, any]) => {
      const stats = splitStatsResult.rows.find((s: any) => s.split_description === splitName);
      
      if (!stats) return null;

      const athleteSeconds = splitData.seconds;
      const avgSeconds = parseFloat(stats.avg_seconds);
      const minSeconds = parseFloat(stats.min_seconds);
      const maxSeconds = parseFloat(stats.max_seconds);

      // Calculate percentile (what percentage of athletes were slower)
      const percentile = ((athleteSeconds - minSeconds) / (maxSeconds - minSeconds)) * 100;

      return {
        name: splitName,
        athleteTime: athleteSeconds,
        athleteTimeFormatted: splitData.time,
        averageTime: avgSeconds,
        fastestTime: minSeconds,
        slowestTime: maxSeconds,
        percentile: 100 - percentile // Invert so higher is better
      };
    }).filter(Boolean);

    return NextResponse.json({
      athlete: {
        id: athleteInfo.id,
        bibNumber: athleteInfo.bib_number,
        firstName: athleteInfo.first_name,
        lastName: athleteInfo.last_name,
        gender: athleteInfo.gender,
        position: athleteInfo.position || 0,
        totalTime: athleteInfo.total_time || '00:00:00.000'
      },
      race: {
        id: raceInfo.id,
        name: raceInfo.name,
        date: raceInfo.date
      },
      splits: splitsWithStats
    });

  } catch (error) {
    console.error('[athlete-splits] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Made with Bob
