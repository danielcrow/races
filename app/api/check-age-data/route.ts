import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get tenant from middleware-injected header
    const tenant = request.headers.get('x-tenant');
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 400 }
      );
    }

    // Check if age category columns exist and have data
    const sampleResults = await query(`
      SELECT 
        race_id,
        athlete_id,
        first_name,
        last_name,
        is_relay,
        age_on_dec31,
        age_category,
        age_category_name
      FROM race_results
      WHERE tenant_id = $1
      LIMIT 20
    `, [tenant]);

    // Count results with age categories
    const ageCategoryCount = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(age_category) as with_age_category,
        COUNT(CASE WHEN is_relay = true THEN 1 END) as relays,
        COUNT(CASE WHEN is_relay = false THEN 1 END) as individuals
      FROM race_results
      WHERE tenant_id = $1
    `, [tenant]);

    // Get sample of athletes with birth dates
    const athletesWithBirthDates = await query(`
      SELECT 
        athlete_id,
        first_name,
        last_name,
        date_of_birth
      FROM athletes
      WHERE tenant_id = $1 AND date_of_birth IS NOT NULL
      LIMIT 10
    `, [tenant]);

    return NextResponse.json({
      tenant,
      summary: ageCategoryCount.rows[0],
      sampleResults: sampleResults.rows,
      athletesWithBirthDates: athletesWithBirthDates.rows,
      diagnosis: {
        hasAgeCategories: parseInt(ageCategoryCount.rows[0].with_age_category) > 0,
        hasRelays: parseInt(ageCategoryCount.rows[0].relays) > 0,
        hasBirthDates: athletesWithBirthDates.rows.length > 0,
        recommendation: getRecommendation(ageCategoryCount.rows[0], athletesWithBirthDates.rows.length)
      }
    });

  } catch (error) {
    console.error('[check-age-data] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getRecommendation(summary: any, birthDateCount: number): string {
  const total = parseInt(summary.total);
  const withAge = parseInt(summary.with_age_category);
  const relays = parseInt(summary.relays);
  
  if (total === 0) {
    return 'No race results found. Upload a database first.';
  }
  
  if (withAge === 0 && birthDateCount === 0) {
    return 'No age categories found. Your SQLite database needs a date_of_birth column in the Athlete table. Add birth dates and re-upload.';
  }
  
  if (withAge === 0 && birthDateCount > 0) {
    return 'Athletes have birth dates but no age categories. Run the schema migration, then re-upload your database.';
  }
  
  if (withAge > 0 && relays === 0) {
    return `Age categories working (${withAge}/${total} results). No relay teams detected - check if team names contain " / " separator.`;
  }
  
  return `System working correctly! ${withAge} results with age categories, ${relays} relay teams.`;
}

// Made with Bob