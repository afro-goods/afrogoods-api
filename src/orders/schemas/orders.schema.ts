import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './orders-item.schema';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  SHIPPED = 'shipped',
}

@Schema({ timestamps: true })
export class Order {
  // ✅ BUSINESS ORDER ID (TRACKING, PAYMENTS, EMAILS)
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop()
  paymentIntentId?: string;

  @Prop({ default: false })
  isPaid: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
