/** Kid validation is enforced in key_store.resolveVerificationKey */

const KID_MAX_LENGTH = 256;
const KID_PATTERN = /^[a-zA-Z0-9_\-.:]+$/;

export function extractKid(header: Record<string, unknown>): string | undefined {
  const kid = header.kid;
  if (kid === undefined || kid === null) return undefined;
  if (typeof kid !== 'string') return undefined;
  // Reject excessively long or suspicious kid values
  if (kid.length > KID_MAX_LENGTH || !KID_PATTERN.test(kid)) return undefined;
  return kid;
}
