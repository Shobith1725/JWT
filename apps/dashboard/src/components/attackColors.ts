import type { AttackVector } from '../types';

/* Neon-inspired palette for each attack vector */
const map: Record<string, string> = {
  none: '#22ff88',
  none_exploit: '#ff3366',
  algorithm_downgrade: '#ff8800',
  kid_injection: '#ffd000',
  key_confusion: '#a855f7',
  replay_attack: '#3b9eff',
  token_theft: '#ec4899',
  malformed: '#64748b',
  invalid_signature: '#6b7280',
  invalid_claims: '#94a3b8',
};

export function attackColor(vector: string): string {
  return map[vector] ?? '#6b7280';
}

export type { AttackVector };
