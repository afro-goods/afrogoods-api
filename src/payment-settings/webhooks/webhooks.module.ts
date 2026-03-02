import { Module } from '@nestjs/common';
import { StripeModule } from '../../shared/stripe/stripe.module';
import { OrdersModule } from '../../orders/orders.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [StripeModule, OrdersModule],
  controllers: [WebhooksController],
})
export class WebhooksModule { }
