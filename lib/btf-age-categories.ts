/**
 * British Triathlon Federation (BTF) Age Categories
 * Age categories are based on the athlete's age on December 31st of the race year
 */

export interface BTFAgeCategory {
  code: string;
  name: string;
  minAge: number;
  maxAge: number | null; // null means no upper limit
}

// BTF Age Categories
export const BTF_AGE_CATEGORIES: BTFAgeCategory[] = [
  { code: 'JUN', name: 'Junior', minAge: 16, maxAge: 19 },
  { code: 'SEN', name: 'Senior', minAge: 20, maxAge: 39 },
  { code: 'V40', name: 'Veteran 40-44', minAge: 40, maxAge: 44 },
  { code: 'V45', name: 'Veteran 45-49', minAge: 45, maxAge: 49 },
  { code: 'V50', name: 'Veteran 50-54', minAge: 50, maxAge: 54 },
  { code: 'V55', name: 'Veteran 55-59', minAge: 55, maxAge: 59 },
  { code: 'V60', name: 'Veteran 60-64', minAge: 60, maxAge: 64 },
  { code: 'V65', name: 'Veteran 65-69', minAge: 65, maxAge: 69 },
  { code: 'V70', name: 'Veteran 70-74', minAge: 70, maxAge: 74 },
  { code: 'V75', name: 'Veteran 75+', minAge: 75, maxAge: null },
];

// Youth categories (under 16)
export const BTF_YOUTH_CATEGORIES: BTFAgeCategory[] = [
  { code: 'U8', name: 'Under 8', minAge: 0, maxAge: 7 },
  { code: 'U10', name: 'Under 10', minAge: 8, maxAge: 9 },
  { code: 'U12', name: 'Under 12', minAge: 10, maxAge: 11 },
  { code: 'U14', name: 'Under 14', minAge: 12, maxAge: 13 },
  { code: 'U16', name: 'Under 16', minAge: 14, maxAge: 15 },
];

// Combined list
export const ALL_AGE_CATEGORIES = [...BTF_YOUTH_CATEGORIES, ...BTF_AGE_CATEGORIES];

/**
 * Calculate age on December 31st of the given year
 * @param birthDate Date of birth
 * @param raceDate Date of the race
 * @returns Age on December 31st of the race year
 */
export function calculateAgeOnDec31(birthDate: Date, raceDate: Date): number {
  const raceYear = raceDate.getFullYear();
  const dec31 = new Date(raceYear, 11, 31); // December 31st of race year
  
  let age = dec31.getFullYear() - birthDate.getFullYear();
  const monthDiff = dec31.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && dec31.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Get BTF age category for an athlete
 * @param age Age on December 31st of race year
 * @returns BTF age category code and name
 */
export function getAgeCategoryForAge(age: number): { code: string; name: string } {
  // Check youth categories first
  for (const category of BTF_YOUTH_CATEGORIES) {
    if (age >= category.minAge && age <= (category.maxAge || Infinity)) {
      return { code: category.code, name: category.name };
    }
  }
  
  // Check adult categories
  for (const category of BTF_AGE_CATEGORIES) {
    if (age >= category.minAge && (category.maxAge === null || age <= category.maxAge)) {
      return { code: category.code, name: category.name };
    }
  }
  
  // Default to Senior if no match (shouldn't happen)
  return { code: 'SEN', name: 'Senior' };
}

/**
 * Get BTF age category from birth date and race date
 * @param birthDate Date of birth (can be string or Date)
 * @param raceDate Date of race (can be string or Date)
 * @returns BTF age category code and name, or null if birth date not available
 */
export function getAgeCategory(
  birthDate: string | Date | null,
  raceDate: string | Date
): { code: string; name: string } | null {
  if (!birthDate) return null;
  
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const race = typeof raceDate === 'string' ? new Date(raceDate) : raceDate;
  
  if (isNaN(birth.getTime()) || isNaN(race.getTime())) {
    return null;
  }
  
  const age = calculateAgeOnDec31(birth, race);
  return getAgeCategoryForAge(age);
}

/**
 * Get all unique age categories from a list of ages
 * @param ages Array of ages
 * @returns Array of unique age category codes
 */
export function getUniqueCategoriesFromAges(ages: number[]): string[] {
  const categories = new Set<string>();
  
  for (const age of ages) {
    const category = getAgeCategoryForAge(age);
    categories.add(category.code);
  }
  
  return Array.from(categories).sort((a, b) => {
    // Sort by the order in ALL_AGE_CATEGORIES
    const indexA = ALL_AGE_CATEGORIES.findIndex(cat => cat.code === a);
    const indexB = ALL_AGE_CATEGORIES.findIndex(cat => cat.code === b);
    return indexA - indexB;
  });
}

/**
 * Format age category for display with gender
 * @param category Age category code
 * @param gender Gender (Male/Female)
 * @returns Formatted string like "M40-44" or "F20-39"
 */
export function formatAgeCategoryWithGender(category: string, gender: string): string {
  const genderPrefix = gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : '';
  const cat = ALL_AGE_CATEGORIES.find(c => c.code === category);
  
  if (!cat) return `${genderPrefix}${category}`;
  
  if (cat.code.startsWith('U')) {
    return `${genderPrefix}${cat.code}`;
  }
  
  if (cat.code === 'JUN') {
    return `${genderPrefix}16-19`;
  }
  
  if (cat.code === 'SEN') {
    return `${genderPrefix}20-39`;
  }
  
  // Veteran categories
  if (cat.maxAge === null) {
    return `${genderPrefix}${cat.minAge}+`;
  }
  
  return `${genderPrefix}${cat.minAge}-${cat.maxAge}`;
}

// Made with Bob