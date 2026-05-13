import Fuse from 'fuse.js';

export interface AthleteMatch {
  firstName: string;
  lastName: string;
  fullName: string;
}

/**
 * Groups athletes by fuzzy matching their names
 * This helps consolidate results for the same athlete even if their name is slightly different
 * (e.g., "John Smith" vs "J Smith" or "John S")
 */
export function groupAthletesByFuzzyMatch(athletes: AthleteMatch[]): Map<string, AthleteMatch[]> {
  const groups = new Map<string, AthleteMatch[]>();
  const processed = new Set<number>();

  athletes.forEach((athlete, index) => {
    if (processed.has(index)) return;

    // Create a group for this athlete
    const group: AthleteMatch[] = [athlete];
    processed.add(index);

    // Find similar athletes
    const remainingAthletes = athletes
      .map((a, i) => ({ athlete: a, index: i }))
      .filter(({ index: i }) => !processed.has(i));

    if (remainingAthletes.length > 0) {
      const fuse = new Fuse(remainingAthletes, {
        keys: [
          { name: 'athlete.firstName', weight: 0.4 },
          { name: 'athlete.lastName', weight: 0.6 }
        ],
        threshold: 0.3, // Lower = more strict matching (0.0 = exact, 1.0 = match anything)
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2
      });

      // Search for similar names
      const firstNameResults = fuse.search(athlete.firstName);
      const lastNameResults = fuse.search(athlete.lastName);
      const fullNameResults = fuse.search(athlete.fullName);

      // Combine results and deduplicate
      const matches = new Set<number>();
      
      [...firstNameResults, ...lastNameResults, ...fullNameResults].forEach(result => {
        if (result.score !== undefined && result.score < 0.3) {
          matches.add(result.item.index);
        }
      });

      // Add matched athletes to the group
      matches.forEach(matchIndex => {
        if (!processed.has(matchIndex)) {
          group.push(athletes[matchIndex]);
          processed.add(matchIndex);
        }
      });
    }

    // Use the most complete name as the group key
    const groupKey = group
      .map(a => a.fullName)
      .sort((a, b) => b.length - a.length)[0];
    
    groups.set(groupKey, group);
  });

  return groups;
}

/**
 * Finds the best matching athlete from a list based on fuzzy search
 */
export function findBestAthleteMatch(
  searchName: string,
  athletes: AthleteMatch[],
  threshold: number = 0.4
): AthleteMatch | null {
  if (athletes.length === 0) return null;

  const fuse = new Fuse(athletes, {
    keys: [
      { name: 'fullName', weight: 0.5 },
      { name: 'firstName', weight: 0.25 },
      { name: 'lastName', weight: 0.25 }
    ],
    threshold,
    includeScore: true,
    ignoreLocation: true
  });

  const results = fuse.search(searchName);
  
  if (results.length > 0 && results[0].score !== undefined && results[0].score < threshold) {
    return results[0].item;
  }

  return null;
}

/**
 * Normalizes athlete name for comparison
 */
export function normalizeAthleteName(firstName: string, lastName: string): string {
  const normalize = (str: string) => 
    str.toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  
  return `${normalize(firstName)} ${normalize(lastName)}`;
}

// Made with Bob