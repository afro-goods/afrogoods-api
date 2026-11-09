export interface CreateCheckoutSessionParams {
  amountCents: number;
  currency: string; // ISO 4217 currency code (lowercase, e.g., 'cad')
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}
