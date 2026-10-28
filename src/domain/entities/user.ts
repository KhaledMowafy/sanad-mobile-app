import type { UserPeriodUsage } from './usage';

export type AccountKind = 'lawyer' | 'individual';

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** E.164, e.g. +201012345678 */
  readonly phone: string | null;
  readonly accountKind: AccountKind;
  readonly barRegistrationNumber: string | null;
  /** e.g. "محامية بالنقض" */
  readonly professionalTitle: string | null;
  /** This month's tokens against the quota, when the backend reports it. */
  readonly usage?: UserPeriodUsage | undefined;
}

/** First letter for the avatar. Works for Arabic and Latin names. */
export function avatarInitial(user: Pick<User, 'name'>): string {
  const first = Array.from(user.name.trim())[0];
  return first ?? '';
}

export function firstName(user: Pick<User, 'name'>): string {
  return user.name.trim().split(/\s+/)[0] ?? '';
}
