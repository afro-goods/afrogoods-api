import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './orders-item.schema';
import { OrderStatus } from '../enums/order-status.enum';
import type {
  Note,
  StatusHistory,
  Address,
} from '../interfaces/order.interface';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop()
  paymentIntentId?: string;

  @Prop({ default: false })
  isPaid: boolean;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Object })
  shippingAddress?: Address;

  @Prop({ type: Object })
  billingAddress?: Address;

  @Prop({ type: [Object], default: [] })
  notes: Note[];

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistory[];

  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  @Prop({ type: String })
  idempotencyKey?: string;

  @Prop({ type: Date })
  idempotencyKeyCreatedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Sparse unique index for idempotency key - only indexes documents where the field exists
OrderSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { idempotencyKey: { $exists: true, $ne: null } },
  },
);
