import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CartItem, CartItemSchema } from './cart-item.schema';

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String })
  guestSessionId?: string;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ type: Number, default: 0 })
  totalAmount: number;

  @Prop({ type: String, default: 'active' })
  status: string;

  @Prop({ type: Date })
  expiresAt?: Date;
}

export type CartDocument = Cart & Document;
export const CartSchema = SchemaFactory.createForClass(Cart);

// Indexes for efficient lookups
CartSchema.index({ userId: 1 });
CartSchema.index({ guestSessionId: 1 });
CartSchema.index({ status: 1 });
CartSchema.index({ expiresAt: 1 });

CartSchema.index({ guestSessionId: 1, status: 1 });

// Ensure either userId or guestSessionId is present
CartSchema.pre('save', function () {
  if (!this.userId && !this.guestSessionId) {
    throw new Error('Either userId or guestSessionId must be provided');
  }
  if (this.userId && this.guestSessionId) {
    throw new Error('Cannot have both userId and guestSessionId');
  }
});
