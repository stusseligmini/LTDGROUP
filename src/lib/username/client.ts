import { appFetch } from '@/lib/network/appFetch';
/**
 * Client-side username resolution and validation
 * Provides caching and helpers for frontend username lookups
 */

interface CachedResolution {
  address: string;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const resolutionCache = new Map<string, CachedResolution>();

/**
 * Resolve username to Solana address with caching
 */
export async function resolveUsername(username: string): Promise<string | null> {
  const normalizedUsername = username.toLowerCase().trim().replace(/^@/, '');

  // Check cache
  const cached = resolutionCache.get(normalizedUsername);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.address;
  }

  try {
    const response = await appFetch(`/api/username/resolve?username=${encodeURIComponent(normalizedUsername)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Username not found
      }
      throw new Error(`Resolution failed: ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || data.solanaAddress;

    if (address) {
      // Cache result
      resolutionCache.set(normalizedUsername, {
        address,
        timestamp: Date.now(),
      });
      return address;
    }

    return null;
  } catch (error) {
    console.error(`Failed to resolve username ${normalizedUsername}:`, error);
    // Return cached result even if expired, or null
    return cached?.address || null;
  }
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const normalizedUsername = username.toLowerCase().trim().replace(/^@/, '');

  try {
    const response = await appFetch(`/api/username/check?username=${encodeURIComponent(normalizedUsername)}`);
    
    if (!response.ok) {
      throw new Error(`Availability check failed: ${response.status}`);
    }

    const data = await response.json();
    return data.available === true;
  } catch (error) {
    console.error(`Failed to check username availability:`, error);
    return false;
  }
}

/**
 * Validate username format (client-side)
 */
export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const normalizedUsername = username.toLowerCase().trim().replace(/^@/, '');

  // Length check
  if (normalizedUsername.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (normalizedUsername.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  // Format check (alphanumeric + underscore only)
  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  // Start with letter or number
  if (!/^[a-z0-9]/.test(normalizedUsername)) {
    return { valid: false, error: 'Username must start with a letter or number' };
  }

  // Reserved words
  const reserved = ['admin', 'root', 'system', 'api', 'celora', 'support', 'help'];
  if (reserved.includes(normalizedUsername)) {
    return { valid: false, error: 'Username is reserved' };
  }

  return { valid: true };
}

/**
 * Register a new username
 */
export async function registerUsername(username: string, walletAddress: string): Promise<{ success: boolean; error?: string }> {
  const normalizedUsername = username.toLowerCase().trim().replace(/^@/, '');

  // Validate format first
  const validation = validateUsernameFormat(normalizedUsername);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const response = await appFetch('/api/username/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: normalizedUsername,
        walletAddress,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Registration failed' };
    }

    const data = await response.json();
    
    // Cache the new registration
    resolutionCache.set(normalizedUsername, {
      address: walletAddress,
      timestamp: Date.now(),
    });

    return { success: true };
  } catch (error) {
    console.error('Username registration error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Format username for display (add @ prefix)
 */
export function formatUsername(username: string): string {
  const normalized = username.trim().replace(/^@/, '');
  return `@${normalized}`;
}

/**
 * Clear resolution cache (for testing or manual refresh)
 */
export function clearUsernameCache(): void {
  resolutionCache.clear();
}

/**
 * Batch resolve multiple usernames
 */
export async function resolveUsernames(usernames: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Process in parallel but limit concurrency
  const batchSize = 5;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const promises = batch.map(async (username) => {
      const address = await resolveUsername(username);
      return { username, address };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ username, address }) => {
      results.set(username, address);
    });
  }
  
  return results;
}
