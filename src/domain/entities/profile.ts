import type { TokenCount, UserPeriodUsage } from './usage';
import type { User } from './user';

/** Tokens spent on one kind of request this month, with how many model calls that took. */
export interface KindUsage extends TokenCount {
  readonly calls: number;
}

/** Everything the account page says about spending: this month against the quota, and beyond. */
export interface UsageBreakdown {
  /** The calendar month against the quota, with how much is left and when it renews. */
  readonly period: UserPeriodUsage;
  readonly thisPeriod: TokenCount;
  readonly allTime: TokenCount;
  /** This month by kind of request, keyed QA, CASE, MEMO, CHAT, VISION or DRAFT. */
  readonly byKind: Readonly<Record<string, KindUsage>>;
}

/** The signed-in account as the backend knows it, for the profile page. */
export interface AccountProfile {
  readonly user: User;
  readonly role: string | null;
  readonly provider: string | null;
  readonly isVerified: boolean | null;
  readonly isActive: boolean | null;
  readonly createdAt: Date | null;
  readonly lastLogin: Date | null;
  readonly usage: UsageBreakdown | null;
}
