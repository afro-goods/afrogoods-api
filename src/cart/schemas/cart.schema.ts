import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CartItem, CartItemSchema } from './cart-item.schema';

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ type: Number, default: 0 })
  totalAmount: number;

  @Prop({ type: String, default: 'active' })
  status: string;
}

export type CartDocument = Cart & Document;
export const CartSchema = SchemaFactory.createForClass(Cart);

// Indexes for efficient lookups
CartSchema.index({ userId: 1 });
CartSchema.index({ status: 1 });
