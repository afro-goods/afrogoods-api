import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from '../stripe.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebhookEvent,
  WebhookEventDocument,
} from '../schemas/webhook-event.schema';
import { OrdersService } from '../../../../orders/orders.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrdersService,
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody || (req.body as Buffer);
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing signature or body');
    }

    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid signature');
    }

    // Idempotency check/logging
    const existing = await this.webhookEventModel.findOne({
      eventId: event.id,
    });
    if (existing?.processed) {
      return { received: true, duplicate: true };
    }

    const webhookRecord = new this.webhookEventModel({
      eventId: event.id,
      eventType: event.type,
      rawEvent: event,
      processed: false,
      retryCount: 0,
    });
    await webhookRecord.save();

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const paymentIntentId = session.payment_intent as string | undefined;
          const sessionMetadata = session.metadata;

          // Primary method: Use metadata orderId (most reliable)
          if (sessionMetadata?.orderId) {
            const result = await this.ordersService.markOrderAsPaid(
              sessionMetadata.orderId,
            );
            webhookRecord.orderId = result.order?._id || result.guestOrder?._id;
            webhookRecord.paymentIntentId = paymentIntentId;
          }
          // Fallback: Try to find order by payment intent
          else if (paymentIntentId) {
            const { order, guestOrder } =
              await this.ordersService.getOrderByPaymentIntent(paymentIntentId);
            const orderId = order?.orderId || guestOrder?.orderId;

            if (orderId) {
              await this.ordersService.markOrderAsPaid(orderId);
              webhookRecord.orderId = order?._id || guestOrder?._id;
              webhookRecord.paymentIntentId = paymentIntentId;
            }
          }
          break;
        }
        case 'payment_intent.succeeded': {
          const intent = event.data.object;
          const paymentIntentId = intent.id as string;
          const { order, guestOrder } =
            await this.ordersService.getOrderByPaymentIntent(paymentIntentId);
          const orderId = order?.orderId || guestOrder?.orderId;
          if (orderId) {
            await this.ordersService.markOrderAsPaid(orderId);
            webhookRecord.orderId = order?._id || guestOrder?._id;
            webhookRecord.paymentIntentId = paymentIntentId;
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          // Keep order pending; record failure
          const intent = event.data.object;
          webhookRecord.error = intent?.last_payment_error?.message;
          break;
        }
        default:
          break;
      }

      webhookRecord.processed = true;
      webhookRecord.processedAt = new Date();
      await webhookRecord.save();
    } catch (err) {
      webhookRecord.error = (err as Error)?.message;
      webhookRecord.retryCount += 1;
      await webhookRecord.save();
      // Do not throw; respond 200 to avoid Stripe retry storms unless desired
    }

    return { received: true };
  }
}
