import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/postgres';
import { generatePasscode, normalizePasscode } from '@/lib/passcode';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/athletes/[athleteId]/passcode
 * Get athlete's passcode (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const athleteId = parseInt(params.athleteId);

    const result = await query(
      `SELECT passcode, passcode_created_at, first_name, last_name
       FROM athletes
       WHERE athlete_id = $1`,
      [athleteId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching athlete passcode:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passcode' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/athletes/[athleteId]/passcode
 * Generate or regenerate athlete's passcode (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const athleteId = parseInt(params.athleteId);

    // Generate new passcode
    const passcode = generatePasscode();

    const result = await query(
      `UPDATE athletes
       SET passcode = $1, passcode_created_at = CURRENT_TIMESTAMP
       WHERE athlete_id = $2
       RETURNING passcode, passcode_created_at, first_name, last_name`,
      [passcode, athleteId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error generating athlete passcode:', error);
    return NextResponse.json(
      { error: 'Failed to generate passcode' },
      { status: 500 }
    );
  }
}


// Made with Bob
