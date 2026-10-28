import type { UserPeriodUsage } from './usage';

/** A monthly plan. Prices are integer piastres, 100 to the pound. */
export interface Plan {
  readonly code: string;
  readonly name: string;
  readonly pricePiastres: number;
  readonly tokens: number;
  readonly pages: number;
  readonly active: boolean;
  readonly sort: number;
}

/** A one-off pack of tokens, added to a running plan. */
export interface TopUpPack {
  readonly code: string;
  readonly name: string;
  readonly pricePiastres: number;
  readonly tokens: number;
  readonly active: boolean;
  readonly sort: number;
}

export interface Catalogue {
  readonly plans: readonly Plan[];
  readonly packs: readonly TopUpPack[];
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface Subscription {
  /** Null for the trial, which is no plan. */
  readonly plan: Plan | null;
  readonly status: SubscriptionStatus;
  readonly method: string;
  readonly autoRenew: boolean;
  readonly paidUntil: string | null;
}

export type PeriodKind = 'TRIAL' | 'PLAN' | 'TOPUP';

/** The billing period the allowance is measured over. */
export interface BillingPeriod {
  readonly kind: PeriodKind;
  readonly start: string;
  /** Null for a top-up-only period, which stays open until a plan starts. */
  readonly end: string | null;
  readonly tokens: number;
  readonly pages: number;
  /** Top-up tokens carried in from before this period. */
  readonly topupCarried: number;
}

/** What `GET billing/subscription` says: the plan, the period and what is left. */
export interface SubscriptionInfo {
  readonly billingEnabled: boolean;
  /** This account is limited by a plan. False for staff, for a fixed quota, and with billing off. */
  readonly billed: boolean;
  readonly subscription: Subscription | null;
  readonly period: BillingPeriod | null;
  readonly usage: UserPeriodUsage | null;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentPurpose = 'PLAN' | 'RENEWAL' | 'UPGRADE' | 'TOPUP' | 'GRANT';
export type PayMethod = 'card' | 'wallet';

export interface Payment {
  readonly id: string;
  readonly purpose: PaymentPurpose | string;
  readonly status: PaymentStatus;
  readonly planCode: string | null;
  readonly packCode: string | null;
  readonly amountPiastres: number;
  readonly currency: string;
  readonly tokens: number;
  readonly paidAt: string | null;
  readonly createdAt: string;
  /** Why it failed, or what an admin wrote on a grant. */
  readonly note: string;
}

/** Whether a plan can be bought from where the account stands now. */
export type PlanAction = 'current' | 'subscribe' | 'upgrade' | 'later';

/**
 * A larger plan than the running one is an upgrade, starting at once. The same plan or a smaller
 * one is refused by the backend (a smaller plan starts at renewal, which is not built yet), so the
 * screen does not offer it. A trial is no plan: any plan is a subscription.
 */
export function planAction(plan: Plan, current: Subscription | null): PlanAction {
  const running = current?.plan ?? null;
  if (running === null) return 'subscribe';
  if (running.code === plan.code) return 'current';
  return plan.tokens > running.tokens ? 'upgrade' : 'later';
}

/** A pack adds to a plan or a trial. With neither there is nothing to add to. */
export function canBuyPack(current: Subscription | null): boolean {
  return current !== null && current.status !== 'EXPIRED';
}

/**
 * What a plan's tokens buy, from what a request cost on the server (measured means: a question
 * about 6,200 tokens, a case analysis 13,100, a defence memo 19,900). An estimate for the pricing
 * cards, worked out from the plan's own numbers so it follows an admin's edit.
 */
export function estimateRequests(tokens: number): {
  questions: number;
  cases: number;
  memos: number;
} {
  return {
    questions: Math.floor(tokens / 6_200),
    cases: Math.floor(tokens / 13_100),
    memos: Math.floor(tokens / 19_900),
  };
}
