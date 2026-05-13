import { NextResponse } from 'next/server';
import { uploadDatabaseToBlob, getDatabasePath, cleanupTempDatabase } from '@/lib/blob-storage';
import { migrateSQLiteToPostgres } from '@/lib/db/migrate';
import { isPostgresAvailable } from '@/lib/db/postgres';
import fs from 'fs';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let tempDbPath: string | null = null;
  
  try {
    console.log('[upload] Starting upload');

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[upload] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Blob storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('database') as File;
    const mode = (formData.get('mode') as string) || 'full';
    
    console.log(`[upload] Migration mode: ${mode}`);
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.db')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .db file' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Vercel Blob Storage
    console.log(`[upload] Uploading database to blob storage`);
    const blobUrl = await uploadDatabaseToBlob(buffer);
    console.log(`[upload] Database uploaded to blob: ${blobUrl}`);

    // Check if PostgreSQL is available
    const postgresAvailable = await isPostgresAvailable();
    
    let migrationResult = null;
    if (postgresAvailable) {
      console.log(`[upload] PostgreSQL available, starting ${mode} migration`);
      
      // Get the database path (downloads from blob if needed)
      tempDbPath = await getDatabasePath();
      
      // Migrate to PostgreSQL with specified mode
      // Note: tenantId parameter will be removed in migrate.ts update
      migrationResult = await migrateSQLiteToPostgres(tempDbPath, 'default', mode === 'incremental');
      
      if (migrationResult.success) {
        console.log(`[upload] Migration completed successfully`);
        console.log(`[upload] Migration stats:`, migrationResult.stats);
      } else {
        console.error(`[upload] Migration failed:`, migrationResult.error);
      }
    } else {
      console.log(`[upload] PostgreSQL not available, skipping migration`);
    }

    return NextResponse.json({
      success: true,
      message: postgresAvailable
        ? 'Database uploaded and migrated to PostgreSQL successfully'
        : 'Database uploaded successfully (PostgreSQL not configured)',
      filename: file.name,
      size: file.size,
      blobUrl: blobUrl,
      postgresAvailable,
      migration: migrationResult
    });

  } catch (error) {
    console.error('[upload] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  } finally {
    // Cleanup temp database file
    if (tempDbPath) {
      await cleanupTempDatabase(tempDbPath);
    }
  }
}

// Made with Bob
