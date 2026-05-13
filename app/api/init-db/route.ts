import { NextResponse } from 'next/server';
import { initializeSchema } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[init-db] Initializing database schema...');
    await initializeSchema();
    
    return NextResponse.json({
      success: true,
      message: 'Database schema initialized successfully'
    });
  } catch (error) {
    console.error('[init-db] Error:', error);
    
    // Check if error is about existing indexes/tables (which is OK)
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({
        success: true,
        message: 'Database schema already initialized (some objects already exist)'
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Made with Bob