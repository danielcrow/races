import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { transaction, clearTenantData, formatTime } from './postgres';
import { PoolClient } from 'pg';
import { parseRelayTeamNames, isRelayTeam } from '../relay-parser';
import { getAgeCategory, calculateAgeOnDec31 } from '../btf-age-categories';

interface SQLiteRace {
  ID: number;
  RaceName: string;
  RaceDate: string;
}

interface SQLiteAthlete {
  ID: number;
  BibNumber: string;
  Notes: string;
  FName: string;
  LName: string;
  Sex: number;
  DOB?: string; // Date of birth (optional, may be DOB or DateOfBirth column)
  AthleteType?: string; // From AthleteTypes table (e.g., "Relay", "Individual")
}

interface SQLiteSplit {
  RaceID: number;
  AthleteID: number;
  SplitDescription: string;
  SplitDateTime: string;
  PreviousSplitDateTime: string;
}

/**
 * Migrate data from SQLite database to PostgreSQL
 * @param sqlitePath Path to SQLite database file
 * @param incremental If true, only add new races; if false, clear and replace all data
 */
export async function migrateSQLiteToPostgres(
  sqlitePath: string,
  incremental: boolean = false
): Promise<{ success: boolean; stats: any; error?: string }> {
  console.log(`[migrate] Starting migration`);
  console.log(`[migrate] SQLite path: ${sqlitePath}`);
  
  const stats = {
    races: 0,
    athletes: 0,
    splits: 0,
    raceResults: 0,
    athleteStats: 0
  };

  let db: any = null;

  try {
    // Open SQLite database
    db = await open({
      filename: sqlitePath,
      driver: sqlite3.Database
    });

    // Clear existing data only if full migration
    if (!incremental) {
      console.log(`[migrate] Full migration - clearing existing data`);
      await clearTenantData('default');
    } else {
      console.log(`[migrate] Incremental migration - keeping existing data`);
    }

    // Migrate in a transaction
    await transaction(async (client) => {
      // 1. Migrate Races (BATCH INSERT)
      console.log('[migrate] Migrating races...');
      const races = await db.all<SQLiteRace[]>('SELECT ID, RaceName, RaceDate FROM Race');
      
      if (races.length > 0) {
        const raceValues = races.map((race, idx) => {
          const offset = idx * 3;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
        }).join(',');
        
        const raceParams = races.flatMap(race => [race.ID, race.RaceName, race.RaceDate]);
        
        await client.query(
          `INSERT INTO races (race_id, race_name, race_date)
           VALUES ${raceValues}
           ON CONFLICT (race_id) DO UPDATE
           SET race_name = EXCLUDED.race_name, race_date = EXCLUDED.race_date`,
          raceParams
        );
        stats.races = races.length;
      }
      console.log(`[migrate] Migrated ${stats.races} races`);

      // 2. Migrate Athletes (CONSOLIDATE BY NAME)
      console.log('[migrate] Migrating athletes...');
      
      // Check which date of birth column exists (DOB or DateOfBirth)
      let dobColumn = null;
      try {
        const tableInfo = await db.all('PRAGMA table_info(Athlete)');
        const dobCol = tableInfo.find((col: any) =>
          col.name.toLowerCase() === 'dob' || col.name.toLowerCase() === 'dateofbirth'
        );
        if (dobCol) {
          dobColumn = dobCol.name;
          console.log(`[migrate] Found date of birth column: ${dobColumn}`);
        } else {
          console.log('[migrate] No date of birth column found in Athlete table');
        }
      } catch (err) {
        console.warn('[migrate] Could not check for DOB column:', err);
      }
      
      // Try to get athlete data with AthleteType, fall back if table doesn't exist
      let athletes: SQLiteAthlete[] = [];
      let hasAthleteTypes = false;
      
      try {
        // Try with AthleteTypes join
        console.log('[migrate] Attempting to query with AthleteTypes table...');
        athletes = await db.all<SQLiteAthlete[]>(
          `SELECT
            a.ID,
            a.BibNumber,
            a.Notes,
            a.FName,
            a.LName,
            a.Sex,
            at.Description as AthleteType${dobColumn ? ', a.' + dobColumn + ' as DOB' : ''}
          FROM Athlete a
          LEFT JOIN AthleteTypes at ON a.AthleteType = at.ID`
        );
        hasAthleteTypes = true;
        console.log('[migrate] Successfully queried with AthleteTypes table');
        const relayCount = athletes.filter(a => a.AthleteType && a.AthleteType.toLowerCase().includes('relay')).length;
        console.log(`[migrate] Detected ${relayCount} relay entries from AthleteTypes table`);
      } catch (err) {
        // AthleteTypes table doesn't exist or query failed, use simple query
        console.log('[migrate] AthleteTypes table not found, using simple athlete query');
        athletes = await db.all<SQLiteAthlete[]>(
          `SELECT
            ID,
            BibNumber,
            Notes,
            FName,
            LName,
            Sex${dobColumn ? ', ' + dobColumn + ' as DOB' : ''}
          FROM Athlete`
        );
        console.log('[migrate] Will use name-based relay detection only');
      }
      
      console.log(`[migrate] Found ${athletes.length} athletes`);
      
      // Group athletes by normalized name (first + last)
      const athleteMap = new Map<string, any>();
      const idMapping = new Map<number, number>(); // Map old ID to new consolidated ID
      let consolidatedId = 1;
      
      for (const athlete of athletes) {
        const normalizedName = `${(athlete.FName || '').trim().toLowerCase()}|${(athlete.LName || '').trim().toLowerCase()}`;
        
        if (!athleteMap.has(normalizedName)) {
          // First time seeing this name - create new consolidated athlete
          const gender = athlete.Sex === 0 ? 'Male' : athlete.Sex === 1 ? 'Female' : 'Unknown';
          athleteMap.set(normalizedName, {
            athlete_id: consolidatedId,
            bib_number: athlete.BibNumber,
            notes: athlete.Notes,
            first_name: athlete.FName,
            last_name: athlete.LName,
            gender: gender,
            date_of_birth: athlete.DOB || null
          });
          idMapping.set(athlete.ID, consolidatedId);
          consolidatedId++;
        } else {
          // Already have this athlete - map old ID to consolidated ID
          const existing = athleteMap.get(normalizedName);
          idMapping.set(athlete.ID, existing.athlete_id);
          // Update DOB if this record has it and existing doesn't
          if (athlete.DOB && !existing.date_of_birth) {
            existing.date_of_birth = athlete.DOB;
          }
        }
      }
      
      // Insert consolidated athletes
      const consolidatedAthletes = Array.from(athleteMap.values());
      if (consolidatedAthletes.length > 0) {
        const athleteValues = consolidatedAthletes.map((_, idx) => {
          const offset = idx * 7;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
        }).join(',');
        
        const athleteParams = consolidatedAthletes.flatMap(athlete => {
          return [athlete.athlete_id, athlete.bib_number, athlete.notes, athlete.first_name, athlete.last_name, athlete.gender, athlete.date_of_birth];
        });
        
        await client.query(
          `INSERT INTO athletes (athlete_id, bib_number, notes, first_name, last_name, gender, date_of_birth)
           VALUES ${athleteValues}
           ON CONFLICT (athlete_id) DO UPDATE
           SET bib_number = EXCLUDED.bib_number, notes = EXCLUDED.notes,
               first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
               gender = EXCLUDED.gender, date_of_birth = EXCLUDED.date_of_birth`,
          athleteParams
        );
        stats.athletes = consolidatedAthletes.length;
      }
      console.log(`[migrate] Migrated ${stats.athletes} consolidated athletes (from ${athletes.length} original records)`);

      // 3. Migrate Splits (BATCH INSERT in chunks of 1000, using consolidated athlete IDs)
      console.log('[migrate] Migrating splits...');
      const splits = await db.all<SQLiteSplit[]>(
        `SELECT RaceID, AthleteID, SplitDescription, SplitDateTime, PreviousSplitDateTime
         FROM splits
         WHERE SplitDescription IS NOT NULL
         AND AthleteID IS NOT NULL
         AND RaceID IS NOT NULL`
      );
      
      const BATCH_SIZE = 1000;
      for (let i = 0; i < splits.length; i += BATCH_SIZE) {
        const batch = splits.slice(i, i + BATCH_SIZE);
        
        const splitValues = batch.map((_, idx) => {
          const offset = idx * 6;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
        }).join(',');
        
        const splitParams = batch.flatMap(split => {
          let splitSeconds = 0;
          if (split.SplitDateTime && split.PreviousSplitDateTime) {
            const splitTime = new Date(split.SplitDateTime).getTime();
            const prevTime = new Date(split.PreviousSplitDateTime).getTime();
            splitSeconds = (splitTime - prevTime) / 1000;
          }
          
          // Use consolidated athlete ID
          const consolidatedAthleteId = idMapping.get(split.AthleteID) || split.AthleteID;
          
          return [
            split.RaceID,
            consolidatedAthleteId,
            split.SplitDescription,
            split.SplitDateTime,
            split.PreviousSplitDateTime,
            splitSeconds
          ];
        });
        
        await client.query(
          `INSERT INTO splits (race_id, athlete_id, split_description,
                               split_datetime, previous_split_datetime, split_seconds)
           VALUES ${splitValues}`,
          splitParams
        );
        
        stats.splits += batch.length;
        console.log(`[migrate] Migrated ${stats.splits}/${splits.length} splits...`);
      }
      console.log(`[migrate] Migrated ${stats.splits} splits`);

      // 4. Generate Race Results (denormalized for performance)
      console.log('[migrate] Generating race results...');
      stats.raceResults = await generateRaceResults(client, db, idMapping);
      console.log(`[migrate] Generated ${stats.raceResults} race results`);

      // 5. Generate Athlete Statistics
      console.log('[migrate] Generating athlete statistics...');
      stats.athleteStats = await generateAthleteStats(client);
      console.log(`[migrate] Generated ${stats.athleteStats} athlete statistics`);
    });

    await db.close();
    
    console.log('[migrate] Migration completed successfully');
    console.log('[migrate] Stats:', stats);
    
    return { success: true, stats };
  } catch (error) {
    console.error('[migrate] Migration failed:', error);
    return {
      success: false,
      stats,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate denormalized race results for fast queries
 */
async function generateRaceResults(
  client: PoolClient,
  sqliteDb: any,
  idMapping: Map<number, number>
): Promise<number> {
  // Get all races
  const racesResult = await client.query(
    'SELECT race_id FROM races'
  );

  let totalResults = 0;

  for (const race of racesResult.rows) {
    const raceId = race.race_id;

    // Calculate total times and positions for each athlete in this race
    // Note: We get bib_number from athletes table as a fallback, but it will be
    // overridden with race-specific bib from SQLite if available
    const results = await client.query(`
      WITH athlete_times AS (
        SELECT
          s.athlete_id,
          SUM(s.split_seconds) as total_seconds
        FROM splits s
        WHERE s.race_id = $1
        GROUP BY s.athlete_id
      ),
      ranked_athletes AS (
        SELECT
          at.athlete_id,
          at.total_seconds,
          RANK() OVER (ORDER BY at.total_seconds ASC) as position
        FROM athlete_times at
      )
      SELECT
        ra.athlete_id,
        ra.position,
        ra.total_seconds,
        a.bib_number,
        a.notes,
        a.first_name,
        a.last_name,
        a.full_name,
        a.gender,
        a.date_of_birth
      FROM ranked_athletes ra
      JOIN athletes a ON a.athlete_id = ra.athlete_id
      ORDER BY ra.position
    `, [raceId]);
    
    // Get race date for age calculation
    const raceInfo = await client.query(
      'SELECT race_date FROM races WHERE race_id = $1',
      [raceId]
    );
    const raceDate = raceInfo.rows[0]?.race_date;

    // Get all splits for this race at once
    const allSplitsResult = await client.query(`
      SELECT athlete_id, split_description, split_seconds
      FROM splits
      WHERE race_id = $1
      ORDER BY athlete_id, split_datetime
    `, [raceId]);

    // Group splits by athlete
    const splitsByAthlete = new Map<number, any[]>();
    for (const split of allSplitsResult.rows) {
      if (!splitsByAthlete.has(split.athlete_id)) {
        splitsByAthlete.set(split.athlete_id, []);
      }
      splitsByAthlete.get(split.athlete_id)!.push(split);
    }

    // Batch insert race results
    if (results.rows.length > 0) {
      const resultValues = results.rows.map((_, idx) => {
        const offset = idx * 16;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`;
      }).join(',');

      const resultParams = await Promise.all(results.rows.map(async (result) => {
        const athleteId = result.athlete_id;
        
        // Get race-specific bib number and athlete type from SQLite
        // Find the original athlete ID(s) that map to this consolidated ID
        const originalAthleteIds: number[] = [];
        for (const entry of Array.from(idMapping.entries())) {
          const [oldId, newId] = entry;
          if (newId === athleteId) {
            originalAthleteIds.push(oldId);
          }
        }
        
        // Query SQLite for the bib number and athlete type used in this specific race
        let bibNumber = result.bib_number || '';
        let athleteType = null;
        if (originalAthleteIds.length > 0) {
          try {
            // Try with AthleteTypes join - will fail gracefully if table doesn't exist
            const athleteInfo = await sqliteDb.get(
              `SELECT a.BibNumber, at.Description as AthleteType
               FROM Athlete a
               LEFT JOIN AthleteTypes at ON a.AthleteType = at.ID
               WHERE a.ID IN (${originalAthleteIds.join(',')})
               AND a.ID IN (
                 SELECT DISTINCT AthleteID FROM splits WHERE RaceID = ?
               )
               LIMIT 1`,
              [raceId]
            );
            
            if (athleteInfo) {
              if (athleteInfo.BibNumber) {
                bibNumber = athleteInfo.BibNumber;
              }
              if (athleteInfo.AthleteType) {
                athleteType = athleteInfo.AthleteType;
              }
            }
          } catch (err) {
            // If AthleteTypes doesn't exist, try without it
            try {
              const athleteInfo = await sqliteDb.get(
                `SELECT BibNumber
                 FROM Athlete
                 WHERE ID IN (${originalAthleteIds.join(',')})
                 AND ID IN (
                   SELECT DISTINCT AthleteID FROM splits WHERE RaceID = ?
                 )
                 LIMIT 1`,
                [raceId]
              );
              if (athleteInfo && athleteInfo.BibNumber) {
                bibNumber = athleteInfo.BibNumber;
              }
            } catch (err2) {
              console.warn(`[migrate] Could not get race-specific bib for athlete ${athleteId} in race ${raceId}`);
            }
          }
        }
        
        // Fallback: if bib starts with '1986', use notes field
        if (bibNumber && typeof bibNumber === 'string' && bibNumber.startsWith('1986') && result.notes) {
          bibNumber = result.notes;
        }

        // Build splits JSON from pre-fetched data
        const splitsJson: any = {};
        const athleteSplits = splitsByAthlete.get(athleteId) || [];
        for (const split of athleteSplits) {
          splitsJson[split.split_description] = {
            seconds: parseFloat(split.split_seconds),
            time: formatTime(parseFloat(split.split_seconds))
          };
        }

        // Check if this is a relay team (check both AthleteType and name pattern)
        const fullName = result.full_name;
        const isRelayByType = athleteType && athleteType.toLowerCase().includes('relay');
        const isRelayByName = isRelayTeam(fullName);
        const isRelay = isRelayByType || isRelayByName;
        const relayNames = isRelay ? parseRelayTeamNames(fullName) : [];
        
        if (isRelayByType && !isRelayByName) {
          console.log(`[migrate] Detected relay by AthleteType: ${fullName}`);
        }
        
        // Calculate age category
        let ageOnDec31 = null;
        let ageCategory = null;
        let ageCategoryName = null;
        
        if (result.date_of_birth && raceDate && !isRelay) {
          try {
            const birthDate = new Date(result.date_of_birth);
            const race = new Date(raceDate);
            
            if (!isNaN(birthDate.getTime()) && !isNaN(race.getTime())) {
              ageOnDec31 = calculateAgeOnDec31(birthDate, race);
              const category = getAgeCategory(birthDate, race);
              if (category) {
                ageCategory = category.code;
                ageCategoryName = category.name;
              }
            }
          } catch (err) {
            console.warn(`[migrate] Could not calculate age for athlete ${athleteId}:`, err);
          }
        }

        return [
          raceId,
          athleteId,
          result.position,
          bibNumber,
          result.first_name,
          result.last_name,
          fullName,
          result.gender,
          ageOnDec31,
          ageCategory,
          ageCategoryName,
          result.total_seconds,
          formatTime(result.total_seconds),
          isRelay,
          relayNames,
          JSON.stringify(splitsJson)
        ];
      })).then(results => results.flat());

      await client.query(`
        INSERT INTO race_results (
          race_id, athlete_id, position, bib_number,
          first_name, last_name, full_name, gender, age_on_dec31,
          age_category, age_category_name, total_seconds, total_time,
          is_relay, relay_names, splits
        )
        VALUES ${resultValues}
        ON CONFLICT (race_id, athlete_id) DO UPDATE
        SET position = EXCLUDED.position, total_seconds = EXCLUDED.total_seconds,
            total_time = EXCLUDED.total_time, splits = EXCLUDED.splits,
            age_on_dec31 = EXCLUDED.age_on_dec31, age_category = EXCLUDED.age_category,
            age_category_name = EXCLUDED.age_category_name
      `, resultParams);

      totalResults += results.rows.length;
    }
  }

  return totalResults;
}

/**
 * Generate athlete statistics (optimized with single query)
 */
async function generateAthleteStats(client: PoolClient): Promise<number> {
  // Get all race results with race info in one query
  const allRacesResult = await client.query(`
    SELECT
      rr.athlete_id,
      rr.race_id,
      rr.position,
      rr.total_seconds,
      r.race_name,
      r.race_date
    FROM race_results rr
    JOIN races r ON r.race_id = rr.race_id
    ORDER BY rr.athlete_id, r.race_date DESC
  `);

  // Group by athlete
  const athleteRaces = new Map<number, any[]>();
  for (const row of allRacesResult.rows) {
    if (!athleteRaces.has(row.athlete_id)) {
      athleteRaces.set(row.athlete_id, []);
    }
    athleteRaces.get(row.athlete_id)!.push(row);
  }

  // Batch insert stats
  const statsToInsert: any[] = [];
  
  for (const [athleteId, races] of Array.from(athleteRaces.entries())) {
    if (races.length === 0) continue;

    const totalRaces = races.length;
    const bestPosition = Math.min(...races.map((r: any) => r.position));
    const averagePosition = races.reduce((sum: number, r: any) => sum + r.position, 0) / totalRaces;
    const bestTime = Math.min(...races.map((r: any) => parseFloat(r.total_seconds)));
    const averageTime = races.reduce((sum: number, r: any) => sum + parseFloat(r.total_seconds), 0) / totalRaces;
    const firstRaceDate = races[races.length - 1].race_date;
    const lastRaceDate = races[0].race_date;

    // Build races JSON
    const racesJson = races.map((r: any) => ({
      raceId: r.race_id,
      raceName: r.race_name,
      raceDate: r.race_date,
      position: r.position,
      totalSeconds: parseFloat(r.total_seconds)
    }));

    statsToInsert.push([
      athleteId,
      totalRaces,
      bestPosition,
      averagePosition,
      bestTime,
      averageTime,
      firstRaceDate,
      lastRaceDate,
      JSON.stringify(racesJson)
    ]);
  }

  // Batch insert all stats
  if (statsToInsert.length > 0) {
    const statsValues = statsToInsert.map((_, idx) => {
      const offset = idx * 9;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
    }).join(',');

    const statsParams = statsToInsert.flat();

    await client.query(`
      INSERT INTO athlete_stats (
        athlete_id, total_races, best_position, average_position,
        best_time_seconds, average_time_seconds, first_race_date, last_race_date, races
      )
      VALUES ${statsValues}
      ON CONFLICT (athlete_id) DO UPDATE
      SET total_races = EXCLUDED.total_races, best_position = EXCLUDED.best_position,
          average_position = EXCLUDED.average_position, best_time_seconds = EXCLUDED.best_time_seconds,
          average_time_seconds = EXCLUDED.average_time_seconds, first_race_date = EXCLUDED.first_race_date,
          last_race_date = EXCLUDED.last_race_date, races = EXCLUDED.races
    `, statsParams);
  }

  return statsToInsert.length;
}

// Made with Bob