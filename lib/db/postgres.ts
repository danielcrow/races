import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Connection pool singleton
let pool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.race_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('PostgreSQL connection string not configured. Set POSTGRES_URL, race_DATABASE_URL, or DATABASE_URL environment variable.');
    }

    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    console.log('[postgres] Connection pool created');
  }

  return pool;
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`[postgres] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    console.error('[postgres] Query error:', error);
    console.error('[postgres] Query:', text);
    console.error('[postgres] Params:', params);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const schemaPath = path.join(process.cwd(), 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await query(schema);
    console.log('[postgres] Schema initialized successfully');
  } catch (error) {
    console.error('[postgres] Schema initialization error:', error);
    throw error;
  }
}

/**
 * Check if PostgreSQL is configured and available
 */
export async function isPostgresAvailable(): Promise<boolean> {
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.race_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return false;
    }
    
    const result = await query('SELECT 1 as test');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[postgres] Availability check failed:', error);
    return false;
  }
}

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[postgres] Connection pool closed');
  }
}

// Helper function to format time from seconds
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Made with Bob