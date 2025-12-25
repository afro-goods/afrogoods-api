import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false, timestamps: false })
export class CartItem {
  @Prop({
    type: Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ required: true })
  priceAtAddedTime: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

CartItemSchema.index({ productId: 1 });
