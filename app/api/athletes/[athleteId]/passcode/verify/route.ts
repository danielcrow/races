import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { normalizePasscode } from '@/lib/passcode';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * PUT /api/athletes/[athleteId]/passcode/verify
 * Verify athlete's passcode (public endpoint)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }
    
    const athleteId = parseInt(params.athleteId);
    const { passcode } = await request.json();

    if (!passcode) {
      return NextResponse.json({ error: 'Passcode required' }, { status: 400 });
    }

    const normalizedInput = normalizePasscode(passcode);

    const result = await query(
      `SELECT passcode, first_name, last_name
       FROM athletes 
       WHERE tenant_id = $1 AND athlete_id = $2`,
      [tenantId, athleteId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const athlete = result.rows[0];
    
    if (!athlete.passcode) {
      return NextResponse.json(
        { error: 'No passcode set for this athlete' },
        { status: 403 }
      );
    }

    const isValid = normalizedInput === athlete.passcode;

    if (isValid) {
      return NextResponse.json({
        valid: true,
        athlete: {
          first_name: athlete.first_name,
          last_name: athlete.last_name
        }
      });
    } else {
      return NextResponse.json({ valid: false }, { status: 403 });
    }
  } catch (error) {
    console.error('Error verifying athlete passcode:', error);
    return NextResponse.json(
      { error: 'Failed to verify passcode' },
      { status: 500 }
    );
  }
}

// Made with Bob
