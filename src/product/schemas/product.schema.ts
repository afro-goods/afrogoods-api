import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AvailabilityStatus } from '../enums/availabilty-status.enum';
import { DeliveryTimeUnit } from '../enums/delivery-time-unit.enum';

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: String, default: 'CAD' })
  currency: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({
    type: String,
    enum: AvailabilityStatus,
    default: AvailabilityStatus.IN_STOCK,
  })
  availabilityStatus: AvailabilityStatus;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: String })
  weight?: string;

  @Prop({ type: Boolean, default: false })
  isFrozen: boolean;

  @Prop({ type: Boolean, default: false })
  isOrganic: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Types.ObjectId], ref: 'ProductAttribute', default: [] })
  attributes: Types.ObjectId[];

  // Delivery timeline fields
  @Prop({ type: String, enum: DeliveryTimeUnit })
  deliveryTimeUnit?: DeliveryTimeUnit;

  @Prop({ type: Number, min: 1 })
  deliveryMinTime?: number;

  @Prop({ type: Number, min: 1 })
  deliveryMaxTime?: number;

  @Prop({ type: String, maxlength: 500 })
  deliveryNote?: string;

  @Prop({ type: Boolean, default: false })
  requiresScheduledDelivery: boolean;
}

export type ProductDocument = Product & Document;
export const ProductSchema = SchemaFactory.createForClass(Product);
