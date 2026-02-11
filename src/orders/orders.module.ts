import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/orders.schema';
import { GuestOrder, GuestOrderSchema } from './schemas/guest-order.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { AuthModule } from '../auth/auth.module';
import { OrdersEmailService } from './services/orders-email.service';
import { FulfillmentGroupingService } from './services/fulfillment-grouping.service';
import { PaginationService } from '../shared/services/pagination/services/pagination.service';

import { PaymentSettingsModule } from '../payment-settings/payment-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: GuestOrder.name, schema: GuestOrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
    PaymentSettingsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersEmailService,
    FulfillmentGroupingService,
    PaginationService,
  ],
  exports: [OrdersService, OrdersEmailService, FulfillmentGroupingService],
})
export class OrdersModule {}
