import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class CartItem {
  @Prop({
    type: Types.ObjectId,
    ref: 'Product', // 🔴 IMPORTANT: string ref is safest
    required: true,
  })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  priceAtAddedTime: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
