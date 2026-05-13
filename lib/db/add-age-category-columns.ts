/**
 * Migration script to add age category columns to existing database
 * Run this once to update the schema
 */

import { query } from './postgres';

export async function addAgeCategoryColumns(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[migration] Adding age category columns...');
    
    // Add date_of_birth to athletes table if it doesn't exist
    await query(`
      ALTER TABLE athletes 
      ADD COLUMN IF NOT EXISTS date_of_birth DATE
    `);
    console.log('[migration] Added date_of_birth to athletes table');
    
    // Add age category columns to race_results table if they don't exist
    await query(`
      ALTER TABLE race_results 
      ADD COLUMN IF NOT EXISTS age_on_dec31 INTEGER,
      ADD COLUMN IF NOT EXISTS age_category VARCHAR(10),
      ADD COLUMN IF NOT EXISTS age_category_name VARCHAR(50)
    `);
    console.log('[migration] Added age category columns to race_results table');
    
    // Create indexes if they don't exist
    await query(`
      CREATE INDEX IF NOT EXISTS idx_race_results_gender 
      ON race_results(tenant_id, race_id, gender)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_race_results_age_category 
      ON race_results(tenant_id, race_id, age_category)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_race_results_relay 
      ON race_results(tenant_id, race_id, is_relay)
    `);
    console.log('[migration] Created indexes');
    
    return {
      success: true,
      message: 'Age category columns added successfully'
    };
  } catch (error) {
    console.error('[migration] Error adding age category columns:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Made with Bob