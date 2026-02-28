import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../../shared/stripe/stripe.service';
import { OrdersService } from '../../orders/orders.service';
import Stripe from 'stripe';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrdersService,
  ) { }

  /**
   * Stripe webhook. Requires raw body for signature verification.
   * Configure in Stripe Dashboard: checkout.session.completed → this URL.
   */
  @Post('stripe')
  async handleStripe(
    @Req() req: RequestWithRawBody,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body required for Stripe webhook. Ensure main.ts stores raw body for this route.',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);
    if (!event) {
      throw new BadRequestException(
        'Invalid signature or STRIPE_WEBHOOK_SECRET not set',
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        throw new BadRequestException('Checkout session missing metadata.orderId');
      }

      await this.ordersService.confirmOrder(orderId, 'stripe_webhook');
    }

    return { received: true };
  }
}
