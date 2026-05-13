import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    const raceId = parseInt(params.id);
    
    if (isNaN(raceId)) {
      return NextResponse.json(
        { error: 'Invalid race ID' },
        { status: 400 }
      );
    }
    
    // Get filter parameters from URL
    const { searchParams } = new URL(request.url);
    let genderFilter = searchParams.get('gender'); // 'M', 'F', 'Male', 'Female', or null for all
    const relayFilter = searchParams.get('relay'); // 'true', 'false', or null for all
    const ageCategoryFilter = searchParams.get('ageCategory'); // age category code or null for all

    // Convert short gender codes to full names for database query
    if (genderFilter === 'M') genderFilter = 'Male';
    if (genderFilter === 'F') genderFilter = 'Female';

    // Get race info from PostgreSQL
    const raceResult = await query(`
      SELECT race_id as id, race_name as name, race_date as date
      FROM races
      WHERE tenant_id = $1 AND race_id = $2
    `, [tenant, raceId]);

    if (raceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Race not found' },
        { status: 404 }
      );
    }

    const raceInfo = raceResult.rows[0];

    // Build WHERE clause based on filters
    const whereClauses = ['tenant_id = $1', 'race_id = $2'];
    const queryParams: any[] = [tenant, raceId];
    let paramIndex = 3;
    
    if (genderFilter) {
      whereClauses.push(`gender = $${paramIndex}`);
      queryParams.push(genderFilter);
      paramIndex++;
    }
    
    if (relayFilter !== null) {
      whereClauses.push(`is_relay = $${paramIndex}`);
      queryParams.push(relayFilter === 'true');
      paramIndex++;
    }
    
    if (ageCategoryFilter) {
      whereClauses.push(`age_category = $${paramIndex}`);
      queryParams.push(ageCategoryFilter);
      paramIndex++;
    }
    
    const whereClause = whereClauses.join(' AND ');
    
    // Get all results for this race from race_results table with filters
    const resultsQuery = await query(`
      SELECT
        position,
        athlete_id,
        bib_number,
        first_name,
        last_name,
        gender,
        age_on_dec31,
        age_category,
        age_category_name,
        total_time,
        total_seconds,
        is_relay,
        relay_names,
        splits
      FROM race_results
      WHERE ${whereClause}
      ORDER BY position ASC
    `, queryParams);
    
    // Get all results without filters for statistics and available filters
    const allResultsQuery = await query(`
      SELECT
        gender,
        age_category,
        age_category_name,
        is_relay,
        total_seconds
      FROM race_results
      WHERE tenant_id = $1 AND race_id = $2
    `, [tenant, raceId]);
    
    const allResults = allResultsQuery.rows;

    // If no results at all (even without filters), race doesn't exist or has no data
    if (allResults.length === 0) {
      return NextResponse.json(
        { error: 'No results found for this race' },
        { status: 404 }
      );
    }

    const results = resultsQuery.rows;
    
    // If filters returned no results, return empty array (not an error)
    if (results.length === 0) {
      return NextResponse.json({
        race: {
          id: raceInfo.id,
          name: raceInfo.name,
          date: raceInfo.date
        },
        splits: [],
        results: [],
        statistics: {
          totalFinishers: 0,
          maleFinishers: 0,
          femaleFinishers: 0,
          averageTime: '00:00:00.000',
          fastestTime: '00:00:00.000',
          slowestTime: '00:00:00.000',
          averageTimeSeconds: 0,
          fastestTimeSeconds: 0,
          slowestTimeSeconds: 0
        },
        filters: {
          available: {
            genders: Array.from(new Set(allResults.map((r: any) => r.gender).filter(Boolean))),
            ageCategories: Array.from(
              new Set(
                allResults
                  .filter((r: any) => r.age_category && !r.is_relay)
                  .map((r: any) => ({ code: r.age_category, name: r.age_category_name }))
                  .map(cat => JSON.stringify(cat))
              )
            ).map(str => JSON.parse(str)),
            hasRelays: allResults.some((r: any) => r.is_relay)
          },
          applied: {
            gender: genderFilter,
            relay: relayFilter,
            ageCategory: ageCategoryFilter
          },
          counts: {
            total: allResults.length,
            male: allResults.filter((r: any) => r.gender === 'Male').length,
            female: allResults.filter((r: any) => r.gender === 'Female').length,
            relays: allResults.filter((r: any) => r.is_relay).length,
            filtered: 0
          }
        }
      });
    }

    // Extract unique split names from the first result
    const firstResult = results[0];
    const splitsData = typeof firstResult.splits === 'string'
      ? JSON.parse(firstResult.splits)
      : (firstResult.splits || {});
    const splits = Object.keys(splitsData);

    // Calculate statistics
    const totalFinishers = results.length;
    const maleFinishers = results.filter((r: any) => r.gender === 'Male').length;
    const femaleFinishers = results.filter((r: any) => r.gender === 'Female').length;
    
    const times = results.map((r: any) => parseFloat(r.total_seconds));
    const avgTime = times.reduce((a: number, b: number) => a + b, 0) / times.length;
    const fastestTime = Math.min(...times);
    const slowestTime = Math.max(...times);

    // Get available filter options from all results
    const availableGenders = Array.from(new Set(allResults.map((r: any) => r.gender).filter(Boolean)));
    const availableAgeCategories = Array.from(
      new Set(
        allResults
          .filter((r: any) => r.age_category && !r.is_relay)
          .map((r: any) => ({ code: r.age_category, name: r.age_category_name }))
          .map(cat => JSON.stringify(cat))
      )
    ).map(str => JSON.parse(str));
    
    // Sort age categories by their order
    availableAgeCategories.sort((a, b) => {
      const order = ['U8', 'U10', 'U12', 'U14', 'U16', 'JUN', 'SEN', 'V40', 'V45', 'V50', 'V55', 'V60', 'V65', 'V70', 'V75'];
      return order.indexOf(a.code) - order.indexOf(b.code);
    });
    
    const hasRelays = allResults.some((r: any) => r.is_relay);
    
    // Calculate statistics from all results
    const totalFinishersAll = allResults.length;
    const maleFinishersAll = allResults.filter((r: any) => r.gender === 'Male').length;
    const femaleFinishersAll = allResults.filter((r: any) => r.gender === 'Female').length;
    const relayFinishersAll = allResults.filter((r: any) => r.is_relay).length;
    
    // Format results for display
    const formattedResults = results.map((r: any) => {
      const splitsData = typeof r.splits === 'string'
        ? JSON.parse(r.splits)
        : (r.splits || {});
      
      return {
        position: r.position,
        athleteId: r.athlete_id,
        bibNumber: r.bib_number,
        firstName: r.first_name,
        lastName: r.last_name,
        gender: r.gender,
        ageOnDec31: r.age_on_dec31,
        ageCategory: r.age_category,
        ageCategoryName: r.age_category_name,
        totalTime: r.total_time,
        totalSeconds: parseFloat(r.total_seconds),
        isRelay: r.is_relay,
        relayNames: r.relay_names || [],
        splits: splitsData
      };
    });

    return NextResponse.json({
      race: {
        id: raceInfo.id,
        name: raceInfo.name,
        date: raceInfo.date
      },
      splits: splits,
      results: formattedResults,
      statistics: {
        totalFinishers,
        maleFinishers,
        femaleFinishers,
        averageTime: formatTime(avgTime),
        fastestTime: formatTime(fastestTime),
        slowestTime: formatTime(slowestTime),
        averageTimeSeconds: avgTime,
        fastestTimeSeconds: fastestTime,
        slowestTimeSeconds: slowestTime
      },
      filters: {
        available: {
          genders: availableGenders,
          ageCategories: availableAgeCategories,
          hasRelays
        },
        applied: {
          gender: genderFilter,
          relay: relayFilter,
          ageCategory: ageCategoryFilter
        },
        counts: {
          total: totalFinishersAll,
          male: maleFinishersAll,
          female: femaleFinishersAll,
          relays: relayFinishersAll,
          filtered: results.length
        }
      }
    });

  } catch (error) {
    console.error('[race-results] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Made with Bob
