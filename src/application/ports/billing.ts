import type { Catalogue, PayMethod, Payment, SubscriptionInfo } from '@/domain/entities/billing';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface CheckoutRequest {
  /** A plan's code, or a pack's. Exactly one. */
  readonly planCode?: string | undefined;
  readonly packCode?: string | undefined;
  readonly method: PayMethod;
}

export interface BillingGateway {
  /** The plans and packs on sale. Public: a pricing page is read before anyone signs up. */
  catalogue(): Promise<Result<Catalogue, AppError>>;
  subscription(): Promise<Result<SubscriptionInfo, AppError>>;
  /**
   * Starts a payment and returns the gateway's hosted page. Nothing is granted here: the plan or
   * tokens arrive when the payment gateway notifies the backend.
   */
  checkout(
    request: CheckoutRequest,
  ): Promise<Result<{ paymentId: string; checkoutUrl: string }, AppError>>;
  /** What the page the customer returns to polls until the status leaves PENDING. */
  payment(id: string): Promise<Result<Payment, AppError>>;
  /** The caller's payments, newest first. */
  payments(): Promise<Result<readonly Payment[], AppError>>;
}
