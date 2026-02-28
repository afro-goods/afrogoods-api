import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { config } from '../../config';

export interface CreateCheckoutSessionParams {
  orderId: string;
  totalAmountCents: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  isGuest?: boolean;
}

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor() {
    if (config.stripe.secretKey) {
      this.stripe = new Stripe(config.stripe.secretKey, {
        typescript: true,
      });
    }
  }

  isConfigured(): boolean {
    return !!this.stripe;
  }

  /**
   * Create a Stripe Checkout Session for an existing order (mode: payment, currency: CAD).
   * Frontend redirects the user to the returned URL.
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.',
      );
    }

    const metadata: Record<string, string> = {
      orderId: params.orderId,
      isGuest: params.isGuest ? 'true' : 'false',
    };
    if (params.isGuest && params.customerEmail) {
      metadata.guestEmail = params.customerEmail;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'cad',
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `Order ${params.orderId}`,
              description: 'AfroGoods order payment',
            },
            unit_amount: params.totalAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.orderId,
      metadata,
      ...(params.customerEmail && { customer_email: params.customerEmail }),
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe checkout session');
    }

    return { url: session.url };
  }

  /**
   * Verify webhook signature and construct event. Returns null if Stripe is not configured or secret is missing.
   */
  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Stripe.Event | null {
    if (!config.stripe.webhookSecret) {
      return null;
    }
    try {
      return Stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret,
      ) as Stripe.Event;
    } catch {
      return null;
    }
  }
}
