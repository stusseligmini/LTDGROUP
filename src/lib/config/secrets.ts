/**
 * Vercel Environment Variables Manager
 * Simple environment variable retrieval with fallbacks
 */

// In-memory cache to avoid repeated env var lookups
const secretCache = new Map<string, string>();

/**
 * Get secret from environment variables with caching
 */
export async function getSecret(secretName: string, fallbackEnvVar?: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached) {
    return cached;
  }

  // Try environment variable
  const envVarName = fallbackEnvVar || secretName.toUpperCase().replace(/-/g, '_');
  const value = process.env[envVarName];

  if (!value) {
    throw new Error(`Secret ${secretName} not found in environment variables (looking for ${envVarName})`);
  }

  // Cache the value
  secretCache.set(secretName, value);

  return value;
}

/**
 * Get multiple secrets in parallel
 */
export async function getSecrets(secretMappings: Record<string, string>): Promise<Record<string, string>> {
  const promises = Object.entries(secretMappings).map(async ([key, secretName]) => {
    const value = await getSecret(secretName, secretName.toUpperCase().replace(/-/g, '_'));
    return [key, value] as const;
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

/**
 * Clear secret cache (useful for testing or manual rotation)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Pre-warm cache with commonly used secrets
 */
export async function warmSecretCache(): Promise<void> {
  // No-op in Vercel, env vars are always available
}
