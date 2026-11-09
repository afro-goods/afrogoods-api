import Stripe from 'stripe';
import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import { CreateCheckoutSessionParams } from './interfaces/stripe.interface';

@Injectable()
export class StripeService {
  private readonly stripe = new Stripe(config.stripe.secretKey);

  async createCheckoutSession(params: CreateCheckoutSessionParams) {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: 'AfroGoods Order',
              },
              unit_amount: params.amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: params.metadata,
      },
      params.idempotencyKey
        ? { idempotencyKey: params.idempotencyKey }
        : undefined,
    );
    return session;
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret,
    );
  }

  async getSession(sessionId: string) {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  async getPaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
}
