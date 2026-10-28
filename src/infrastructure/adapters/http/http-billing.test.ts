import { describe, expect, it } from 'vitest';
import {
  GetCatalogue,
  GetPayment,
  GetSubscription,
  ListPayments,
  StartCheckout,
} from '@/application/use-cases/billing';
import { canBuyPack, estimateRequests, planAction, type Plan } from '@/domain/entities/billing';
import { blockingLimit } from '@/domain/entities/usage';
import { ApiClient } from '@/infrastructure/http/api-client';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { HttpBillingGateway } from './http-billing-gateway';

const clientFor = (fetchImpl: typeof fetch) =>
  new ApiClient({
    baseUrl: 'http://api.test/api',
    timeoutMs: 1000,
    fetch: fetchImpl,
    tokens: { accessToken: async () => 'tok', refresh: async () => null },
  });

const rawPlan = (code: string, price: number, tokens: number, pages: number, sort: number) => ({
  code,
  name: code[0]!.toUpperCase() + code.slice(1),
  price_piastres: price,
  tokens,
  pages,
  active: true,
  sort,
});

const catalogue = {
  plans: [
    rawPlan('max', 160000, 8_000_000, 1000, 30),
    rawPlan('standard', 30000, 1_000_000, 100, 10),
    rawPlan('pro', 80000, 3_000_000, 300, 20),
  ],
  packs: [
    {
      code: 'topup-500k',
      name: '500K tokens',
      price_piastres: 15000,
      tokens: 500_000,
      active: true,
      sort: 10,
    },
  ],
};

const periodUsage = (over: Record<string, unknown> = {}) => ({
  used: 410000,
  limit: 3500000,
  remaining: 3090000,
  period_start: '2026-10-17T10:00:00+03:00',
  resets_at: '2026-11-17T10:00:00+03:00',
  state: 'ok',
  pages: { used: 12, limit: 300, remaining: 288, state: 'ok' },
  billing: true,
  plan: { code: 'pro', name: 'Pro' },
  subscription: 'ACTIVE',
  ...over,
});

describe('HttpBillingGateway', () => {
  it('reads the public catalogue without a token, cheapest plan first', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope(catalogue))]);
    const result = await new GetCatalogue(new HttpBillingGateway(clientFor(fetch))).execute();

    expect(calls[0]?.url.pathname).toBe('/api/billing/plans');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(result.ok && result.value.plans.map((p) => p.code)).toEqual(['standard', 'pro', 'max']);
    expect(result.ok && result.value.plans[0]).toMatchObject({
      pricePiastres: 30000,
      tokens: 1_000_000,
      pages: 100,
    });
    expect(result.ok && result.value.packs[0]).toMatchObject({
      code: 'topup-500k',
      tokens: 500_000,
    });
  });

  it('reads the plan, the period and the figures behind the allowance', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope({
          billing_enabled: true,
          billed: true,
          subscription: {
            plan: rawPlan('pro', 80000, 3_000_000, 300, 20),
            status: 'ACTIVE',
            method: 'CARD',
            auto_renew: true,
            paid_until: '2026-11-17T10:00:00+03:00',
          },
          period: {
            kind: 'PLAN',
            start: '2026-10-17T10:00:00+03:00',
            end: '2026-11-17T10:00:00+03:00',
            tokens: 3_000_000,
            pages: 300,
            topup_carried: 500_000,
          },
          usage: periodUsage(),
        }),
      ),
    ]);
    const result = await new GetSubscription(new HttpBillingGateway(clientFor(fetch))).execute();
    expect(result).toMatchObject({
      ok: true,
      value: {
        billingEnabled: true,
        billed: true,
        subscription: { plan: { code: 'pro' }, status: 'ACTIVE', autoRenew: true },
        period: { kind: 'PLAN', tokens: 3_000_000, topupCarried: 500_000 },
        usage: {
          billing: true,
          plan: { code: 'pro', name: 'Pro' },
          subscription: 'ACTIVE',
          pages: { used: 12, limit: 300, state: 'ok' },
        },
      },
    });
  });

  it('reads a trial, which is no plan, and a top-up period that never resets', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope({
          billing_enabled: true,
          billed: true,
          subscription: {
            plan: null,
            status: 'TRIAL',
            method: '',
            auto_renew: false,
            paid_until: '2026-11-17T10:00:00+03:00',
          },
          period: {
            kind: 'TOPUP',
            start: '2026-10-17T10:00:00+03:00',
            end: null,
            tokens: 0,
            pages: 0,
            topup_carried: 200000,
          },
          usage: periodUsage({ resets_at: null, plan: null, subscription: 'TRIAL' }),
        }),
      ),
    ]);
    const result = await new GetSubscription(new HttpBillingGateway(clientFor(fetch))).execute();
    expect(result).toMatchObject({
      ok: true,
      value: {
        subscription: { plan: null, status: 'TRIAL' },
        period: { kind: 'TOPUP', end: null },
        usage: { resetsAt: null, plan: null, subscription: 'TRIAL' },
      },
    });
  });

  it('starts a checkout with a plan or a pack and the chosen method, never an amount', async () => {
    const { fetch, calls } = fakeFetch([
      json(201, envelope({ payment_id: 17, checkout_url: 'https://eg.checkout.paymob.com/?x=1' })),
      json(201, envelope({ payment_id: 18, checkout_url: 'https://eg.checkout.paymob.com/?x=2' })),
    ]);
    const useCase = new StartCheckout(new HttpBillingGateway(clientFor(fetch)));

    const plan = await useCase.execute({ planCode: 'pro', method: 'card' });
    const pack = await useCase.execute({ packCode: 'topup-500k', method: 'wallet' });

    expect(calls[0]?.url.pathname).toBe('/api/billing/checkout');
    expect(calls[0]?.body).toEqual({ plan: 'pro', method: 'card' });
    expect(calls[1]?.body).toEqual({ pack: 'topup-500k', method: 'wallet' });
    expect(plan).toEqual({
      ok: true,
      value: { paymentId: '17', checkoutUrl: 'https://eg.checkout.paymob.com/?x=1' },
    });
    expect(pack.ok && pack.value.paymentId).toBe('18');
  });

  it('refuses a checkout for both or neither before calling the backend', async () => {
    const { fetch, calls } = fakeFetch([]);
    const useCase = new StartCheckout(new HttpBillingGateway(clientFor(fetch)));
    expect(await useCase.execute({ method: 'card' })).toMatchObject({ ok: false });
    expect(await useCase.execute({ planCode: 'pro', packCode: 'x', method: 'card' })).toMatchObject(
      {
        ok: false,
      },
    );
    expect(calls).toHaveLength(0);
  });

  it('maps a refused checkout (payments off, or a plan not allowed) to a validation error', async () => {
    const { fetch } = fakeFetch([
      json(400, { status_code: 400, message: 'Payments are not available yet.', data: null }),
    ]);
    const result = await new StartCheckout(new HttpBillingGateway(clientFor(fetch))).execute({
      planCode: 'pro',
      method: 'card',
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it.each([
    ['PENDING', 'PENDING'],
    ['PAID', 'PAID'],
    ['FAILED', 'FAILED'],
    ['REFUNDED', 'REFUNDED'],
    ['SOMETHING_NEW', 'PENDING'],
  ])('reads a %s payment as %s', async (api, expected) => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope({
          id: 17,
          purpose: 'UPGRADE',
          status: api,
          plan: 'pro',
          pack: null,
          amount_piastres: 80000,
          currency: 'EGP',
          tokens: 0,
          paid_at: null,
          created_at: '2026-10-17T10:00:00+03:00',
          note: '',
        }),
      ),
    ]);
    const result = await new GetPayment(new HttpBillingGateway(clientFor(fetch))).execute('17');
    expect(result.ok && result.value.status).toBe(expected);
  });

  it('lists the payments from the paginated envelope', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        200,
        envelope(
          [
            {
              id: 3,
              purpose: 'TOPUP',
              status: 'PAID',
              plan: null,
              pack: 'topup-500k',
              amount_piastres: 15000,
              currency: 'EGP',
              tokens: 500000,
              paid_at: '2026-10-18T10:00:00+03:00',
              created_at: '2026-10-18T09:59:00+03:00',
              note: '',
            },
          ],
          { next: null, previous: null },
        ),
      ),
    ]);
    const result = await new ListPayments(new HttpBillingGateway(clientFor(fetch))).execute();
    expect(calls[0]?.url.pathname).toBe('/api/billing/payments');
    expect(result.ok && result.value[0]).toMatchObject({
      id: '3',
      packCode: 'topup-500k',
      tokens: 500000,
    });
  });
});

describe('what a plan can do from where the account stands', () => {
  const plan = (code: string, tokens: number): Plan => ({
    code,
    name: code,
    pricePiastres: 0,
    tokens,
    pages: 0,
    active: true,
    sort: 0,
  });
  const standard = plan('standard', 1_000_000);
  const pro = plan('pro', 3_000_000);
  const max = plan('max', 8_000_000);
  const onPro = {
    plan: pro,
    status: 'ACTIVE' as const,
    method: 'CARD',
    autoRenew: true,
    paidUntil: null,
  };

  it('offers every plan to an account with none, or on a trial', () => {
    expect(planAction(pro, null)).toBe('subscribe');
    expect(planAction(pro, { ...onPro, plan: null, status: 'TRIAL' })).toBe('subscribe');
  });

  it('marks the current plan, upgrades to a larger one and holds back a smaller one', () => {
    expect(planAction(pro, onPro)).toBe('current');
    expect(planAction(max, onPro)).toBe('upgrade');
    expect(planAction(standard, onPro)).toBe('later');
  });

  it('allows a top-up only with a plan or a trial running', () => {
    expect(canBuyPack(null)).toBe(false);
    expect(canBuyPack({ ...onPro, status: 'EXPIRED' })).toBe(false);
    expect(canBuyPack(onPro)).toBe(true);
    expect(canBuyPack({ ...onPro, plan: null, status: 'TRIAL' })).toBe(true);
  });

  it('estimates requests from the plan tokens', () => {
    expect(estimateRequests(1_000_000)).toEqual({ questions: 161, cases: 76, memos: 50 });
  });
});

describe('a spent allowance with billing', () => {
  const user = (over: Record<string, unknown>) => ({
    conversation: null,
    user: {
      used: 1,
      limit: 1,
      remaining: 0,
      periodStart: '2026-10-01T00:00:00Z',
      resetsAt: null,
      state: 'exhausted' as const,
      pages: null,
      billing: true,
      plan: { code: 'pro', name: 'Pro' },
      subscription: 'ACTIVE' as const,
      ...over,
    },
  });

  it('names what cures it: more tokens, a plan, or waiting for the calendar', () => {
    expect(blockingLimit(user({}))).toBe('plan_tokens');
    expect(blockingLimit(user({ plan: null, subscription: null }))).toBe('no_plan');
    expect(blockingLimit(user({ billing: false, plan: null, subscription: null }))).toBe(
      'monthly_tokens',
    );
  });
});
