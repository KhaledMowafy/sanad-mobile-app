import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { BillingGateway, CheckoutRequest } from '@/application/ports/billing';
import { ok, type Result } from '@/application/result';
import type {
  Catalogue,
  Payment,
  PaymentStatus,
  Plan,
  SubscriptionInfo,
  SubscriptionStatus,
  TopUpPack,
} from '@/domain/entities/billing';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { toUserPeriodUsage } from '@/infrastructure/http/usage-mappers';

const planSchema = z.looseObject({
  code: z.string(),
  name: z.string(),
  price_piastres: z.number(),
  tokens: z.number(),
  pages: z.number(),
  active: z.boolean().nullish(),
  sort: z.number().nullish(),
});

const packSchema = z.looseObject({
  code: z.string(),
  name: z.string(),
  price_piastres: z.number(),
  tokens: z.number(),
  active: z.boolean().nullish(),
  sort: z.number().nullish(),
});

const catalogueSchema = z.looseObject({
  plans: z.array(planSchema),
  packs: z.array(packSchema),
});

const subscriptionSchema = z.looseObject({
  billing_enabled: z.boolean(),
  billed: z.boolean(),
  subscription: z
    .looseObject({
      plan: planSchema.nullish(),
      status: z.string(),
      method: z.string().nullish(),
      auto_renew: z.boolean().nullish(),
      paid_until: z.string().nullish(),
    })
    .nullish(),
  period: z
    .looseObject({
      kind: z.string(),
      start: z.string(),
      end: z.string().nullish(),
      tokens: z.number(),
      pages: z.number(),
      topup_carried: z.number(),
    })
    .nullish(),
  /** The usage block; read by usage-mappers. */
  usage: z.unknown().optional(),
});

const checkoutSchema = z.looseObject({
  payment_id: z.number(),
  checkout_url: z.string(),
});

const paymentSchema = z.looseObject({
  id: z.number(),
  purpose: z.string(),
  status: z.string(),
  plan: z.string().nullish(),
  pack: z.string().nullish(),
  amount_piastres: z.number(),
  currency: z.string().nullish(),
  tokens: z.number().nullish(),
  paid_at: z.string().nullish(),
  created_at: z.string(),
  note: z.string().nullish(),
});

type ApiPlan = z.infer<typeof planSchema>;
type ApiPack = z.infer<typeof packSchema>;

const toPlan = (p: ApiPlan): Plan => ({
  code: p.code,
  name: p.name,
  pricePiastres: p.price_piastres,
  tokens: p.tokens,
  pages: p.pages,
  active: p.active ?? true,
  sort: p.sort ?? 0,
});

const toPack = (p: ApiPack): TopUpPack => ({
  code: p.code,
  name: p.name,
  pricePiastres: p.price_piastres,
  tokens: p.tokens,
  active: p.active ?? true,
  sort: p.sort ?? 0,
});

const STATUSES: readonly PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
];

export function toPayment(api: z.infer<typeof paymentSchema>): Payment {
  const status = api.status.toUpperCase() as PaymentStatus;
  return {
    id: String(api.id),
    purpose: api.purpose,
    // An unknown status is treated as still pending: the page keeps asking, never wrongly paid.
    status: STATUSES.includes(status) ? status : 'PENDING',
    planCode: api.plan ?? null,
    packCode: api.pack ?? null,
    amountPiastres: api.amount_piastres,
    currency: api.currency ?? 'EGP',
    tokens: api.tokens ?? 0,
    paidAt: api.paid_at ?? null,
    createdAt: api.created_at,
    note: api.note?.trim() ?? '',
  };
}

export class HttpBillingGateway implements BillingGateway {
  constructor(private readonly client: ApiClient) {}

  async catalogue(): Promise<Result<Catalogue, AppError>> {
    const result = await this.client.request({
      path: '/billing/plans',
      schema: catalogueSchema,
      auth: false,
    });
    if (!result.ok) return result;
    return ok({
      plans: result.value.plans.map(toPlan).sort((a, b) => a.sort - b.sort),
      packs: result.value.packs.map(toPack).sort((a, b) => a.sort - b.sort),
    });
  }

  async subscription(): Promise<Result<SubscriptionInfo, AppError>> {
    const result = await this.client.request({
      path: '/billing/subscription',
      schema: subscriptionSchema,
    });
    if (!result.ok) return result;
    const v = result.value;
    const status = (v.subscription?.status ?? '').toUpperCase() as SubscriptionStatus;
    const kind = v.period?.kind.toUpperCase();
    return ok({
      billingEnabled: v.billing_enabled,
      billed: v.billed,
      subscription: v.subscription
        ? {
            plan: v.subscription.plan ? toPlan(v.subscription.plan) : null,
            status: SUBSCRIPTION_STATUSES.includes(status) ? status : 'ACTIVE',
            method: v.subscription.method ?? '',
            autoRenew: v.subscription.auto_renew ?? false,
            paidUntil: v.subscription.paid_until ?? null,
          }
        : null,
      period: v.period
        ? {
            kind: kind === 'TRIAL' || kind === 'TOPUP' ? kind : 'PLAN',
            start: v.period.start,
            end: v.period.end ?? null,
            tokens: v.period.tokens,
            pages: v.period.pages,
            topupCarried: v.period.topup_carried,
          }
        : null,
      usage: toUserPeriodUsage(v.usage),
    });
  }

  async checkout(
    request: CheckoutRequest,
  ): Promise<Result<{ paymentId: string; checkoutUrl: string }, AppError>> {
    const result = await this.client.request({
      method: 'POST',
      path: '/billing/checkout',
      body: {
        ...(request.planCode ? { plan: request.planCode } : {}),
        ...(request.packCode ? { pack: request.packCode } : {}),
        method: request.method,
      },
      schema: checkoutSchema,
    });
    return result.ok
      ? ok({ paymentId: String(result.value.payment_id), checkoutUrl: result.value.checkout_url })
      : result;
  }

  async payment(id: string): Promise<Result<Payment, AppError>> {
    const result = await this.client.request({
      path: `/billing/payments/${encodeURIComponent(id)}`,
      schema: paymentSchema,
    });
    return result.ok ? ok(toPayment(result.value)) : result;
  }

  async payments(): Promise<Result<readonly Payment[], AppError>> {
    const result = await this.client.requestPage({
      path: '/billing/payments',
      schema: paymentSchema,
    });
    return result.ok ? ok(result.value.items.map(toPayment)) : result;
  }
}
