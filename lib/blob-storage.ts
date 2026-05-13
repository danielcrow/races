import { put, head } from '@vercel/blob';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const DATABASE_NAME = 'RaceTiming.db';

/**
 * Upload database to Vercel Blob Storage
 * In development without Vercel Blob token, saves to local file
 */
export async function uploadDatabaseToBlob(buffer: Buffer): Promise<string> {
  // In development without valid Vercel Blob token, save locally
  if (!process.env.VERCEL && (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder'))) {
    const localPath = path.join(process.cwd(), DATABASE_NAME);
    await writeFile(localPath, buffer);
    return `file://${localPath}`;
  }
  
  // Use Vercel Blob in production or when token is configured
  const blob = await put(DATABASE_NAME, buffer, {
    access: 'public' as any, // Store is configured as private, this will be overridden
    addRandomSuffix: false,
  });
  
  return blob.url;
}

/**
 * Download database from Vercel Blob Storage to local temp file
 */
export async function downloadDatabaseFromBlob(): Promise<string> {
  try {
    // Check if blob exists and get its URL
    const blobInfo = await head(DATABASE_NAME);
    
    if (!blobInfo) {
      throw new Error('Database not found in blob storage');
    }

    // Fetch the blob content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      throw new Error('Failed to download database from blob storage');
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to temp location
    const tempPath = path.join('/tmp', DATABASE_NAME);
    await writeFile(tempPath, buffer);

    return tempPath;
  } catch (error) {
    // If blob doesn't exist, check for local file (development)
    const localPath = path.join(process.cwd(), DATABASE_NAME);
    if (existsSync(localPath)) {
      return localPath;
    }
    
    throw error;
  }
}

/**
 * Get database path (downloads from blob if needed)
 */
export async function getDatabasePath(): Promise<string> {
  // In production (Vercel), always use blob storage
  if (process.env.VERCEL) {
    return await downloadDatabaseFromBlob();
  }
  
  // In development, use local file
  const localPath = path.join(process.cwd(), DATABASE_NAME);
  
  if (existsSync(localPath)) {
    return localPath;
  }
  
  // Try to download from blob as fallback
  try {
    return await downloadDatabaseFromBlob();
  } catch {
    throw new Error('Database not found. Please upload a database file.');
  }
}

/**
 * Clean up temporary database file
 */
export async function cleanupTempDatabase(dbPath: string): Promise<void> {
  if (dbPath.startsWith('/tmp/')) {
    try {
      await unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if database exists
 */
export async function databaseExists(): Promise<boolean> {
  try {
    const blobInfo = await head(DATABASE_NAME);
    return !!blobInfo;
  } catch {
    // In development, check local file
    if (!process.env.VERCEL) {
      const localPath = path.join(process.cwd(), DATABASE_NAME);
      return existsSync(localPath);
    }
    
    return false;
  }
}

// Made with Bob
