/**
 * Athlete Passcode Utilities
 * Generates and validates passcodes for athlete profile access
 */

/**
 * Generate a random 8-character alphanumeric passcode
 * Uses uppercase letters and numbers, excluding ambiguous characters (0, O, I, 1)
 */
export function generatePasscode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0, O, I, 1
  let passcode = '';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    passcode += chars[randomIndex];
  }
  
  return passcode;
}

/**
 * Format passcode for display (e.g., "ABCD-EFGH")
 */
export function formatPasscode(passcode: string): string {
  if (passcode.length !== 8) return passcode;
  return `${passcode.slice(0, 4)}-${passcode.slice(4)}`;
}

/**
 * Normalize passcode input (remove spaces, dashes, convert to uppercase)
 */
export function normalizePasscode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validate passcode format
 */
export function isValidPasscodeFormat(passcode: string): boolean {
  const normalized = normalizePasscode(passcode);
  return /^[A-Z0-9]{8}$/.test(normalized);
}

// Made with Bob
