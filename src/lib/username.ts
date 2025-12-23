/**
 * Unified username utilities: resolution, validation, registration, caching
 * Uses centralized constants from username-constants.ts
 */
import {
  normalizeUsername,
  validateNormalizedUsername,
  type UsernameValidationResult,
} from './username-constants';
import { fetchWithAbort } from './network/requestPool';
import { fetchWithRetry } from './network/fetchWithRetry';
import { usernameCache } from './cache/lruUsernameCache';
import { trackUsernameLookup, trackUsernameAvailability, trackUsernameRegistration } from './telemetry/usernameEvents';

// Structured error codes for consumer differentiation
export enum UsernameErrorCode {
  Network = 'NETWORK',
  NotFound = 'NOT_FOUND',
  InvalidFormat = 'INVALID_FORMAT',
  Taken = 'TAKEN',
  Unknown = 'UNKNOWN',
}

export interface ResolveUsernameResult {
  address: string | null;
  error?: UsernameErrorCode;
}

export interface AvailabilityResult {
  available: boolean;
  error?: UsernameErrorCode;
}

export interface RegistrationResult {
  success: boolean;
  error?: UsernameErrorCode | string;
}

// Legacy constants retained for reference; LRU cache now used
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes TTL for freshness check

export async function resolveUsername(username: string): Promise<ResolveUsernameResult> {
  const normalizedUsername = normalizeUsername(username);
  const cachedAddress = usernameCache.get(normalizedUsername);
  if (cachedAddress && usernameCache.isFresh(normalizedUsername)) {
    return { address: cachedAddress };
  }
  try {
    const response = await fetchWithAbort(`/api/username?username=${encodeURIComponent(normalizedUsername)}`);
    // Retry logic only applied after initial non-aborted attempt if server errors
    if (!response.ok && response.status >= 500) {
      const retryResponse = await fetchWithRetry(`/api/username?username=${encodeURIComponent(normalizedUsername)}`);
      if (!retryResponse.ok) {
        if (retryResponse.status === 404) {
          trackUsernameLookup(normalizedUsername, UsernameErrorCode.NotFound);
          return { address: null, error: UsernameErrorCode.NotFound };
        }
        trackUsernameLookup(normalizedUsername, UsernameErrorCode.Unknown);
        return { address: null, error: UsernameErrorCode.Unknown };
      }
      const retryData = await retryResponse.json();
      const retryAddress = retryData.address || retryData.solanaAddress;
      if (retryAddress) {
        usernameCache.set(normalizedUsername, retryAddress);
        trackUsernameLookup(normalizedUsername);
        return { address: retryAddress };
      }
    }
    if (!response.ok) {
      if (response.status === 404) {
        trackUsernameLookup(normalizedUsername, UsernameErrorCode.NotFound);
        return { address: null, error: UsernameErrorCode.NotFound };
      }
      trackUsernameLookup(normalizedUsername, UsernameErrorCode.Unknown);
      return { address: null, error: UsernameErrorCode.Unknown };
    }
    const data = await response.json();
    const address = data.address || data.solanaAddress;
    if (address) {
      usernameCache.set(normalizedUsername, address);
      trackUsernameLookup(normalizedUsername);
      return { address };
    }
    trackUsernameLookup(normalizedUsername, UsernameErrorCode.NotFound);
    return { address: null, error: UsernameErrorCode.NotFound };
  } catch (error) {
    console.error(`Failed to resolve username ${normalizedUsername}:`, error);
    trackUsernameLookup(normalizedUsername, UsernameErrorCode.Network);
    return { address: cachedAddress || null, error: UsernameErrorCode.Network };
  }
}

export async function checkUsernameAvailability(username: string): Promise<AvailabilityResult> {
  const normalizedUsername = normalizeUsername(username);
  try {
    const response = await fetchWithAbort(`/api/username/check?username=${encodeURIComponent(normalizedUsername)}`);
    if (!response.ok && response.status >= 500) {
      const retryResponse = await fetchWithRetry(`/api/username/check?username=${encodeURIComponent(normalizedUsername)}`);
      if (!retryResponse.ok) {
        if (retryResponse.status === 404) {
          trackUsernameAvailability(normalizedUsername, true);
          return { available: true };
        }
        trackUsernameAvailability(normalizedUsername, false, UsernameErrorCode.Unknown);
        return { available: false, error: UsernameErrorCode.Unknown };
      }
      const retryData = await retryResponse.json();
      const avail = retryData.available === true;
      trackUsernameAvailability(normalizedUsername, avail);
      return { available: avail };
    }
    if (!response.ok) {
      if (response.status === 404) {
        // 404 means not found -> available
        trackUsernameAvailability(normalizedUsername, true);
        return { available: true };
      }
      trackUsernameAvailability(normalizedUsername, false, UsernameErrorCode.Unknown);
      return { available: false, error: UsernameErrorCode.Unknown };
    }
    const data = await response.json();
    const available = data.available === true;
    trackUsernameAvailability(normalizedUsername, available);
    return { available };
  } catch (error) {
    console.error(`Failed to check username availability:`, error);
    trackUsernameAvailability(normalizedUsername, false, UsernameErrorCode.Network);
    return { available: false, error: UsernameErrorCode.Network };
  }
}

export function validateUsernameFormat(username: string): UsernameValidationResult {
  const normalizedUsername = normalizeUsername(username);
  return validateNormalizedUsername(normalizedUsername);
}

export async function registerUsername(username: string, walletAddress: string): Promise<RegistrationResult> {
  const normalizedUsername = normalizeUsername(username);
  const validation = validateNormalizedUsername(normalizedUsername);
  if (!validation.valid) return { success: false, error: UsernameErrorCode.InvalidFormat };
  try {
    const response = await fetch('/api/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalizedUsername, solanaAddress: walletAddress }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 409) {
        trackUsernameRegistration(normalizedUsername, false, UsernameErrorCode.Taken);
        return { success: false, error: UsernameErrorCode.Taken };
      }
      if (response.status >= 500) {
        // retry once for server error
        try {
          const retryResponse = await fetchWithRetry('/api/username', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: normalizedUsername, solanaAddress: walletAddress }) });
          if (!retryResponse.ok) {
            const retryErr = await retryResponse.json().catch(() => ({}));
            return { success: false, error: retryErr.error || UsernameErrorCode.Unknown };
          }
          usernameCache.set(normalizedUsername, walletAddress);
          trackUsernameRegistration(normalizedUsername, true);
          return { success: true };
        } catch (e) {
          trackUsernameRegistration(normalizedUsername, false, UsernameErrorCode.Network);
          return { success: false, error: UsernameErrorCode.Network };
        }
      }
      trackUsernameRegistration(normalizedUsername, false, UsernameErrorCode.Unknown);
      return { success: false, error: errorData.error || UsernameErrorCode.Unknown };
    }
    usernameCache.set(normalizedUsername, walletAddress);
    trackUsernameRegistration(normalizedUsername, true);
    return { success: true };
  } catch (error) {
    console.error('Username registration error:', error);
    trackUsernameRegistration(normalizedUsername, false, UsernameErrorCode.Network);
    return { success: false, error: UsernameErrorCode.Network };
  }
}

export function formatUsername(username: string): string {
  const normalized = normalizeUsername(username);
  return `@${normalized}`;
}

export function clearUsernameCache(): void {
  usernameCache.clear();
}

export async function resolveUsernames(usernames: string[]): Promise<Map<string, ResolveUsernameResult>> {
  const results = new Map<string, ResolveUsernameResult>();
  const batchSize = 5;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const promises = batch.map(async (username) => {
      const result = await resolveUsername(username);
      return { username, result };
    });
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ username, result }) => {
      results.set(username, result);
    });
  }
  return results;
}
