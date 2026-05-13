import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/postgres';
import { generatePasscode, formatPasscode } from '@/lib/passcode';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/athletes/passcodes
 * Get all athletes with their passcodes (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      `SELECT
        athlete_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        passcode,
        passcode_created_at
       FROM athletes
       ORDER BY last_name, first_name`
    );

    return NextResponse.json({ athletes: result.rows });
  } catch (error) {
    console.error('Error fetching athlete passcodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch athlete passcodes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/athletes/passcodes/generate-all
 * Generate passcodes for all athletes without one (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get athletes without passcodes
    const athletesResult = await query(
      `SELECT athlete_id FROM athletes
       WHERE passcode IS NULL OR passcode = ''`
    );

    let generated = 0;
    for (const athlete of athletesResult.rows) {
      const passcode = generatePasscode();
      await query(
        `UPDATE athletes
         SET passcode = $1, passcode_created_at = CURRENT_TIMESTAMP
         WHERE athlete_id = $2`,
        [passcode, athlete.athlete_id]
      );
      generated++;
    }

    return NextResponse.json({
      success: true,
      generated,
      message: `Generated passcodes for ${generated} athletes`
    });
  } catch (error) {
    console.error('Error generating passcodes:', error);
    return NextResponse.json(
      { error: 'Failed to generate passcodes' },
      { status: 500 }
    );
  }
}

// Made with Bob
