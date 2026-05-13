import { put, head } from '@vercel/blob';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { getTenantDatabaseName } from './tenant';

/**
 * Upload database to Vercel Blob Storage for a specific tenant
 * In development without Vercel Blob token, saves to local file
 */
export async function uploadDatabaseToBlob(buffer: Buffer, tenant: string): Promise<string> {
  const blobName = getTenantDatabaseName(tenant);
  
  // In development without valid Vercel Blob token, save locally
  if (!process.env.VERCEL && (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN.includes('placeholder'))) {
    const localPath = path.join(process.cwd(), blobName);
    await writeFile(localPath, buffer);
    return `file://${localPath}`;
  }
  
  // Use Vercel Blob in production or when token is configured
  const blob = await put(blobName, buffer, {
    access: 'public' as any, // Store is configured as private, this will be overridden
    addRandomSuffix: false,
  });
  
  return blob.url;
}

/**
 * Download database from Vercel Blob Storage to local temp file
 */
export async function downloadDatabaseFromBlob(tenant: string): Promise<string> {
  const blobName = getTenantDatabaseName(tenant);
  
  try {
    // Check if blob exists and get its URL
    const blobInfo = await head(blobName);
    
    if (!blobInfo) {
      throw new Error(`Database not found in blob storage for tenant: ${tenant}`);
    }

    // Fetch the blob content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      throw new Error('Failed to download database from blob storage');
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to temp location with tenant-specific name
    const tempPath = path.join('/tmp', blobName);
    await writeFile(tempPath, buffer);

    return tempPath;
  } catch (error) {
    // If blob doesn't exist, check for local file (development)
    const localPath = path.join(process.cwd(), blobName);
    if (existsSync(localPath)) {
      return localPath;
    }
    
    // For 'default' tenant in development, try the old filename
    if (tenant === 'default') {
      const oldPath = path.join(process.cwd(), 'RaceTiming.db');
      if (existsSync(oldPath)) {
        return oldPath;
      }
    }
    
    throw error;
  }
}

/**
 * Get database path for a specific tenant (downloads from blob if needed)
 */
export async function getDatabasePath(tenant: string): Promise<string> {
  // In production (Vercel), always use blob storage
  if (process.env.VERCEL) {
    return await downloadDatabaseFromBlob(tenant);
  }
  
  // In development, use local file
  const blobName = getTenantDatabaseName(tenant);
  const localPath = path.join(process.cwd(), blobName);
  
  if (existsSync(localPath)) {
    return localPath;
  }
  
  // For 'default' tenant, try the old filename
  if (tenant === 'default') {
    const oldPath = path.join(process.cwd(), 'RaceTiming.db');
    if (existsSync(oldPath)) {
      return oldPath;
    }
  }
  
  // Try to download from blob as fallback
  try {
    return await downloadDatabaseFromBlob(tenant);
  } catch {
    throw new Error(`Database not found for tenant: ${tenant}. Please upload a database file.`);
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
 * Check if tenant database exists
 */
export async function tenantDatabaseExists(tenant: string): Promise<boolean> {
  const blobName = getTenantDatabaseName(tenant);
  
  try {
    const blobInfo = await head(blobName);
    return !!blobInfo;
  } catch {
    // In development, check local file
    if (!process.env.VERCEL) {
      const localPath = path.join(process.cwd(), blobName);
      if (existsSync(localPath)) {
        return true;
      }
      
      // For 'default' tenant, check old filename
      if (tenant === 'default') {
        const oldPath = path.join(process.cwd(), 'RaceTiming.db');
        return existsSync(oldPath);
      }
    }
    
    return false;
  }
}

// Made with Bob
