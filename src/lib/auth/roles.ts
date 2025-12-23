/**
 * Role utilities based on Firebase custom claims.
 */
export type DecodedToken = {
  [key: string]: any;
  uid: string;
  email?: string;
  roles?: string[] | Record<string, boolean>;
};

export function extractRoles(token: DecodedToken): string[] {
  if (!token) return [];
  if (Array.isArray(token.roles)) return token.roles;
  if (typeof token.roles === 'object' && token.roles) {
    return Object.entries(token.roles)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }
  // Support individual role flags, e.g. token.admin === true
  const flags = ['admin', 'support', 'moderator'];
  return flags.filter(r => token[r] === true);
}

export function hasRole(token: DecodedToken, role: string): boolean {
  return extractRoles(token).includes(role);
}

export function requireRole(token: DecodedToken, role: string) {
  if (!hasRole(token, role)) {
    const roles = extractRoles(token);
    const err = new Error(`Insufficient role. Required: ${role}. Present: ${roles.join(', ') || 'none'}`);
    (err as any).status = 403;
    throw err;
  }
}
