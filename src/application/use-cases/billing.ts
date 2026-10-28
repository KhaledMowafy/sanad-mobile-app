import type { Catalogue, Payment, SubscriptionInfo } from '@/domain/entities/billing';
import { FieldValidator, type AppError } from '../errors';
import type { BillingGateway, CheckoutRequest } from '../ports/billing';
import { err, type Result } from '../result';

export class GetCatalogue {
  constructor(private readonly billing: BillingGateway) {}

  execute(): Promise<Result<Catalogue, AppError>> {
    return this.billing.catalogue();
  }
}

export class GetSubscription {
  constructor(private readonly billing: BillingGateway) {}

  execute(): Promise<Result<SubscriptionInfo, AppError>> {
    return this.billing.subscription();
  }
}

export class StartCheckout {
  constructor(private readonly billing: BillingGateway) {}

  /** The amount is never sent: the backend reads it from the plan or pack. */
  execute(
    request: CheckoutRequest,
  ): Promise<Result<{ paymentId: string; checkoutUrl: string }, AppError>> {
    // Exactly one of a plan and a pack.
    if (Boolean(request.planCode) === Boolean(request.packCode)) {
      const validator = new FieldValidator();
      validator.fail('plan', 'invalid');
      return Promise.resolve(err(validator.toError()));
    }
    return this.billing.checkout(request);
  }
}

export class GetPayment {
  constructor(private readonly billing: BillingGateway) {}

  execute(id: string): Promise<Result<Payment, AppError>> {
    if (id.trim().length === 0) return Promise.resolve(err({ kind: 'not_found' }));
    return this.billing.payment(id);
  }
}

export class ListPayments {
  constructor(private readonly billing: BillingGateway) {}

  execute(): Promise<Result<readonly Payment[], AppError>> {
    return this.billing.payments();
  }
}
