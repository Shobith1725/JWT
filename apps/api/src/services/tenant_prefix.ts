/**
 * Returns a Redis key prefix for the given tenant.
 * - With a tenantId → 'tenant:acmecorp123:'
 * - Without         → ''  (zero-break: keys are identical to single-tenant mode)
 */
export function getTenantPrefix(tenantId?: string): string {
  if (!tenantId) return '';
  return `tenant:${tenantId}:`;
}
