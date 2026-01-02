// src/orders/schemas/order-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  priceAtPurchase: number; // snapshot
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
