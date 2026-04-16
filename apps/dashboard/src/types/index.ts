export type AttackVector =
  | 'none_exploit'
  | 'algorithm_downgrade'
  | 'kid_injection'
  | 'key_confusion'
  | 'replay_attack'
  | 'token_theft'
  | 'malformed'
  | 'invalid_signature'
  | 'invalid_claims';

export type ShieldEventType = 'JWT_ATTACK_BLOCKED' | 'JWT_REQUEST_VALID';

export interface AttackEvent {
  timestamp: string;
  event_type: ShieldEventType | string;
  attack_vector: AttackVector | string;
  source_ip: string;
  attempted_algorithm: string | null;
  token_fingerprint: string;
  user_agent: string;
  blocked: boolean;
  detail?: string;
  subject?: string;
}

export interface StatsSummary {
  total_requests: number;
  total_blocked: number;
  total_valid: number;
  block_rate_percent: number;
  attacks_by_type: Record<string, number>;
  blocked_ips: number;
  uptime_seconds: number;
}

export interface BlockedIpRow {
  ip: string;
  reason: string;
  expiresAt: number | null;
  permanent: boolean;
}
