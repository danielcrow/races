import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { getDatabasePath, cleanupTempDatabase } from '@/lib/blob-storage';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  let dbPath: string | null = null;
  
  try {
    const raceId = parseInt(params.id);
    
    if (isNaN(raceId)) {
      return NextResponse.json(
        { error: 'Invalid race ID' },
        { status: 400 }
      );
    }

    // Get database path (downloads from blob if needed)
    dbPath = await getDatabasePath();
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Get unique splits
    const splits = await db.all(`
      SELECT DISTINCT SplitDescription 
      FROM splits 
      WHERE RaceID = ? AND SplitDescription IS NOT NULL
      ORDER BY SplitDateTime ASC
    `, [raceId]);

    if (splits.length === 0) {
      await db.close();
      return NextResponse.json(
        { error: 'No splits found for this race' },
        { status: 404 }
      );
    }

    // Build dynamic CASE statements for each split duration
    const pivotColumns = splits.map((split: any) => {
      const safeName = split.SplitDescription.replace(/'/g, "''");
      return `
        MAX(CASE WHEN splits.SplitDescription = '${safeName}' THEN 
          printf('%02d:%02d:%02d.%03d',
            CAST(COALESCE((julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime)), 0) * 24 AS INT),
            CAST((COALESCE((julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime)), 0) * 1440) % 60 AS INT),
            CAST((COALESCE((julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime)), 0) * 86400) % 60 AS INT),
            CAST((COALESCE((julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime)), 0) * 86400000) % 1000 AS INT)
          ) END) AS "${safeName}"`;
    }).join(',');

    // Overall Time calculation
    const overallTimeSql = `
      printf('%02d:%02d:%02d.%03d',
        CAST(SUM(COALESCE(julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime), 0)) * 24 AS INT),
        CAST((SUM(COALESCE(julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime), 0)) * 1440) % 60 AS INT),
        CAST((SUM(COALESCE(julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime), 0)) * 86400) % 60 AS INT),
        CAST((SUM(COALESCE(julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime), 0)) * 86400000) % 1000 AS INT)
      ) AS "Overall Time"`;

    // Final Query
    const query = `
      SELECT 
        RANK() OVER (ORDER BY SUM(COALESCE(julianday(splits.SplitDateTime) - julianday(splits.PreviousSplitDateTime), 0)) ASC) AS Position,
        Athlete.Notes AS "Bib Number",
        Athlete.FName AS "First Name", 
        Athlete.LName AS "Last Name",
        CASE Athlete.Sex 
          WHEN 0 THEN 'Male' 
          WHEN 1 THEN 'Female' 
          ELSE 'Unknown' 
        END AS Gender,
        ${pivotColumns},
        ${overallTimeSql}
      FROM splits
      INNER JOIN Athlete ON Athlete.ID = splits.AthleteID  
      WHERE splits.RaceID = ${raceId}
      GROUP BY Athlete.ID
      ORDER BY Position ASC
    `;

    const results = await db.all(query);
    await db.close();

    // Convert to CSV
    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No results found for this race' },
        { status: 404 }
      );
    }

    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map((row: any) => 
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
            return `"${value.toString().replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Race_${raceId}_Results.csv"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Clean up temp file if it was downloaded
    if (dbPath) {
      await cleanupTempDatabase(dbPath);
    }
  }
}

// Made with Bob
