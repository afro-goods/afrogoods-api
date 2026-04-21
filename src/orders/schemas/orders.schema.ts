import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './orders-item.schema';
import { Fulfillment, FulfillmentSchema } from './fulfillment.schema';
import { OrderStatus } from '../enums/order-status.enum';
import type {
  Note,
  StatusHistory,
  Address,
} from '../interfaces/order.interface';
import { PaymentMethod } from '../enums/payment-method.enum';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: String, required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: String })
  paymentIntentId?: string;

  @Prop({
    type: String,
    enum: PaymentMethod,
    default: PaymentMethod.E_TRANSFER,
  })
  paymentMethod: PaymentMethod;

  @Prop({ type: String })
  stripeSessionId?: string;

  @Prop({ type: String })
  paymentStatus?: string;

  @Prop({ type: String })
  stripeCustomerId?: string;

  @Prop({ type: Number })
  stripeAmount?: number;

  @Prop({ type: String })
  stripeCurrency?: string;

  @Prop({ type: Number })
  processingFee?: number;

  @Prop({ type: Number })
  orderSubtotal?: number;

  @Prop({ type: Number })
  deliveryFee?: number;

  @Prop({ type: Boolean, default: false })
  isPaid: boolean;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Object })
  shippingAddress?: Address;

  @Prop({ type: Object })
  billingAddress?: Address;

  @Prop({ type: [Object], default: [] })
  notes: Note[];

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistory[];

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: [FulfillmentSchema], default: [] })
  fulfillments: Fulfillment[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ paymentIntentId: 1 }, { sparse: true });
OrderSchema.index({ stripeSessionId: 1 }, { sparse: true });
