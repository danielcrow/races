import { findBestAthleteMatch, type AthleteMatch } from './fuzzy-match';

/**
 * Parses a name that might contain multiple athletes (relay team)
 * Common separators: " / ", " & ", " and ", " + "
 */
export function parseRelayTeamNames(fullName: string): string[] {
  // Split by common separators
  const separators = [' / ', ' & ', ' and ', ' + ', '/'];
  let names = [fullName];
  
  for (const separator of separators) {
    if (fullName.includes(separator)) {
      names = fullName.split(separator).map(n => n.trim());
      break;
    }
  }
  
  return names.filter(n => n.length > 0);
}

/**
 * Checks if a name appears to be a relay team (contains multiple names)
 */
export function isRelayTeam(fullName: string): boolean {
  const names = parseRelayTeamNames(fullName);
  return names.length > 1;
}

/**
 * Attempts to find athlete IDs for each name in a relay team
 * Returns an array of objects with the parsed name and matched athlete ID (if found)
 */
export async function findRelayTeamAthletes(
  fullName: string,
  allAthletes: AthleteMatch[]
): Promise<Array<{ name: string; athleteId?: number }>> {
  const names = parseRelayTeamNames(fullName);
  
  return names.map(name => {
    // Try to match this name to an athlete
    const match = findBestAthleteMatch(name, allAthletes, 0.5);
    
    return {
      name,
      athleteId: match ? (match as any).id : undefined
    };
  });
}

/**
 * Splits a full name into first and last name
 * Handles various formats like "John Smith", "Smith, John", etc.
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  
  // Handle "LastName, FirstName" format
  if (trimmed.includes(',')) {
    const [lastName, firstName] = trimmed.split(',').map(s => s.trim());
    return { firstName: firstName || '', lastName: lastName || '' };
  }
  
  // Handle "FirstName LastName" format
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }
  
  // Assume last part is last name, everything else is first name
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  
  return { firstName, lastName };
}

// Made with Bob