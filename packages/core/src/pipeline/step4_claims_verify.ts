import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { ShieldError } from '../errors';

export interface Step4Result {
  payload: Record<string, unknown>;
}

export function step4ClaimsVerify(
  token: string,
  publicKey: string | Buffer,
  algorithm: string,
  allowedIssuers: string[],
  allowedAudiences: string[],
  maxTokenAgeSecs: number,
  clockSkewSeconds: number,
  enableFingerprintBinding: boolean,
  context: { userAgent?: string; acceptLanguage?: string; ip?: string }
): Step4Result {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, publicKey, {
      algorithms: [algorithm as jwt.Algorithm],
      complete: false,
      clockTolerance: clockSkewSeconds,
    }) as jwt.JwtPayload;
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
    if (name === 'TokenExpiredError') {
      throw new ShieldError('invalid_claims', 'Token expired', algorithm);
    }
    if (name === 'JsonWebTokenError') {
      throw new ShieldError('invalid_signature', 'Invalid JWT signature', algorithm);
    }
    throw new ShieldError('invalid_signature', 'JWT verification failed', algorithm);
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = clockSkewSeconds;

  if (decoded.exp === undefined) {
    throw new ShieldError('invalid_claims', 'Missing exp claim', algorithm);
  }
  if (decoded.exp <= now - skew) {
    throw new ShieldError('invalid_claims', 'Token expired', algorithm);
  }

  if (decoded.iat === undefined) {
    throw new ShieldError('invalid_claims', 'Missing iat claim', algorithm);
  }
  if (decoded.iat > now + skew) {
    throw new ShieldError('invalid_claims', 'iat is in the future', algorithm);
  }

  if (decoded.nbf !== undefined && now < decoded.nbf - skew) {
    throw new ShieldError('invalid_claims', 'Token not yet valid (nbf)', algorithm);
  }

  const iss = decoded.iss;
  if (typeof iss !== 'string' || !allowedIssuers.includes(iss)) {
    throw new ShieldError('invalid_claims', 'Invalid iss', algorithm);
  }

  const normalizeAud = (aud: jwt.JwtPayload['aud']): string[] => {
    if (aud === undefined) return [];
    if (typeof aud === 'string') return [aud];
    if (Array.isArray(aud)) return aud.filter((a): a is string => typeof a === 'string');
    return [];
  };

  const audiences = normalizeAud(decoded.aud);
  if (audiences.length === 0 || !audiences.some((a) => allowedAudiences.includes(a))) {
    throw new ShieldError('invalid_claims', 'Invalid aud', algorithm);
  }

  const age = decoded.exp - decoded.iat;
  if (age > maxTokenAgeSecs) {
    throw new ShieldError('invalid_claims', 'Token lifetime exceeds max allowed', algorithm);
  }

  if (enableFingerprintBinding) {
    const fgp = decoded.fgp;
    if (typeof fgp !== 'string' || fgp.length === 0) {
      throw new ShieldError('token_theft', 'Missing session fingerprint (fgp)', algorithm);
    }
    const expected = computeFingerprintHash(context);
    if (!expected || expected !== fgp) {
      throw new ShieldError('token_theft', 'Session fingerprint mismatch', algorithm);
    }
  }

  return { payload: decoded as Record<string, unknown> };
}

/** Exported for API login — same algorithm as middleware check */
export function computeFingerprintHash(context: {
  userAgent?: string;
  acceptLanguage?: string;
  ip?: string;
}): string {
  const ua = context.userAgent ?? '';
  const al = context.acceptLanguage ?? '';
  const subnet = ipToSlash24(context.ip);
  const raw = `${ua}|${al}|${subnet}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function ipToSlash24(ip: string | undefined): string {
  if (!ip || ip.length === 0) return '0.0.0.0';
  const v4 = ip.replace(/^::ffff:/i, '');
  const parts = v4.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(':')) {
    const segs = ip.split(':').filter(Boolean);
    return segs.slice(0, 4).join(':') + '::';
  }
  return 'unknown';
}
