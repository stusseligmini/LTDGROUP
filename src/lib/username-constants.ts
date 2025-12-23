// Centralized username constants and normalization

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-z0-9_]+$/; // allowed chars
export const USERNAME_START_REGEX = /^[a-z0-9]/;
export const RESERVED_USERNAMES = [
  'admin','root','system','api','celora','support','help','staff','service','owner'
];

export function normalizeUsername(input: string): string {
  return input.toLowerCase().trim().replace(/^@/, '');
}

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateNormalizedUsername(normalized: string): UsernameValidationResult {
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: `Username must be ${USERNAME_MAX_LENGTH} characters or less` };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  if (!USERNAME_START_REGEX.test(normalized)) {
    return { valid: false, error: 'Username must start with a letter or number' };
  }
  if (RESERVED_USERNAMES.includes(normalized)) {
    return { valid: false, error: 'Username is reserved' };
  }
  return { valid: true };
}
