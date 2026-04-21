import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './orders-item.schema';
import { Fulfillment, FulfillmentSchema } from './fulfillment.schema';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import type { Note, StatusHistory } from '../interfaces/order.interface';

export type GuestOrderDocument = GuestOrder & Document;

@Schema({ _id: false })
export class CustomerInfo {
  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  phone: string;
}

export const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);

@Schema({ _id: false })
export class GuestAddress {
  @Prop({ type: String, required: true })
  street: string;

  @Prop({ type: String })
  apartment?: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  postalCode: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: String })
  instructions?: string;
}

export const GuestAddressSchema = SchemaFactory.createForClass(GuestAddress);

@Schema({ timestamps: true })
export class GuestOrder {
  @Prop({ type: String, required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: CustomerInfoSchema, required: true })
  customerInfo: CustomerInfo;

  @Prop({ type: GuestAddressSchema, required: true })
  shippingAddress: GuestAddress;

  @Prop({ type: GuestAddressSchema })
  billingAddress?: GuestAddress;

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

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: [Object], default: [] })
  notes: Note[];

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistory[];

  @Prop({ type: Date })
  anonymizedAt?: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: [FulfillmentSchema], default: [] })
  fulfillments: Fulfillment[];
}

export const GuestOrderSchema = SchemaFactory.createForClass(GuestOrder);

// Add indexes for efficient lookups
GuestOrderSchema.index({ orderId: 1, 'customerInfo.email': 1 });
GuestOrderSchema.index({ 'customerInfo.email': 1 });
GuestOrderSchema.index({ createdAt: 1 }); // For cleanup queries
GuestOrderSchema.index({ anonymizedAt: 1 }); // For anonymized data cleanup
GuestOrderSchema.index({ userId: 1 }); // For transferred orders
GuestOrderSchema.index({ paymentIntentId: 1 }, { sparse: true });
GuestOrderSchema.index({ stripeSessionId: 1 }, { sparse: true });
