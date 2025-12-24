import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart, CartSchema } from './schemas/cart.schema';

import { Product, ProductSchema } from '../product/schemas/product.schema'; // ✅ ADD

import { UsersModule } from '../users/users.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema }, // ✅ REQUIRED FOR POPULATE
    ]),
    UsersModule,
    FirebaseModule,
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
