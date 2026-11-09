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

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: Number, required: true })
  priceAtAddedTime: number;

  @Prop({ type: Object, default: {} })
  selectedAttributes?: Record<string, any>;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

CartItemSchema.index({ productId: 1 });
