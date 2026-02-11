import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './orders-item.schema';
import { Fulfillment, FulfillmentSchema } from './fulfillment.schema';
import { OrderStatus } from '../enums/order-status.enum';
import type { Note, StatusHistory } from '../interfaces/order.interface';

export type GuestOrderDocument = GuestOrder & Document;

@Schema({ _id: false })
export class CustomerInfo {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;
}

export const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);

@Schema({ _id: false })
export class GuestAddress {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ required: true })
  country: string;
}

export const GuestAddressSchema = SchemaFactory.createForClass(GuestAddress);

@Schema({ timestamps: true })
export class GuestOrder {
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: CustomerInfoSchema, required: true })
  customerInfo: CustomerInfo;

  @Prop({ type: GuestAddressSchema, required: true })
  shippingAddress: GuestAddress;

  @Prop({ type: GuestAddressSchema })
  billingAddress?: GuestAddress;

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

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: [Object], default: [] })
  notes: Note[];

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistory[];

  @Prop()
  anonymizedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
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
