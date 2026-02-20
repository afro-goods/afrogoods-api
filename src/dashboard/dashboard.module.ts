import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order, OrderSchema } from '../orders/schemas/orders.schema';
import {
  GuestOrder,
  GuestOrderSchema,
} from '../orders/schemas/guest-order.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { Advert, AdvertSchema } from '../adverts/schemas/advert.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: GuestOrder.name, schema: GuestOrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Advert.name, schema: AdvertSchema },
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
