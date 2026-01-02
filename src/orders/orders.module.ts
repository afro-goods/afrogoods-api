import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/orders.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema }, // ✅ FIX
    ]),
    AuthModule, // ✅ fixes req.user
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
