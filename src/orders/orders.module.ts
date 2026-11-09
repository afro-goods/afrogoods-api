import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/orders.schema';
import { GuestOrder, GuestOrderSchema } from './schemas/guest-order.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import {
  WebhookEvent,
  WebhookEventSchema,
} from '../shared/services/stripe/schemas/webhook-event.schema';
import { AuthModule } from '../auth/auth.module';
import { OrdersEmailService } from './services/orders-email.service';
import { FulfillmentGroupingService } from './services/fulfillment-grouping.service';
import { PaginationService } from '../shared/services/pagination/services/pagination.service';
import { SharedModule } from '../shared/shared.module';
import { PaymentSettingsModule } from '../payment-settings/payment-settings.module';
import { StripeWebhookController } from '../shared/services/stripe/webhooks/webhook.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: GuestOrder.name, schema: GuestOrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    AuthModule,
    SharedModule,
    PaymentSettingsModule,
  ],
  controllers: [OrdersController, StripeWebhookController],
  providers: [
    OrdersService,
    OrdersEmailService,
    FulfillmentGroupingService,
    PaginationService,
  ],
  exports: [OrdersService, OrdersEmailService, FulfillmentGroupingService],
})
export class OrdersModule {}
