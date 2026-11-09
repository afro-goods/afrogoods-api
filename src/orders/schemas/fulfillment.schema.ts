import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FulfillmentType } from '../enums/fulfillment-type.enum';
import { FulfillmentStatus } from '../enums/fulfillment-status.enum';
import { ShippingCarrier } from '../enums/shipping-carrier.enum';

export interface FulfillmentStatusHistory {
  status: FulfillmentStatus;
  previousStatus?: FulfillmentStatus;
  reason?: string;
  updatedBy: string;
  createdAt: Date;
}

@Schema({ _id: false })
export class Fulfillment {
  @Prop({ type: String, enum: FulfillmentType, required: true })
  type: FulfillmentType;

  @Prop({
    type: String,
    enum: FulfillmentStatus,
    default: FulfillmentStatus.PENDING,
  })
  status: FulfillmentStatus;

  // References to items array by index
  @Prop({ type: [Number], required: true })
  itemIndices: number[];

  @Prop({ type: String, enum: ShippingCarrier })
  carrier?: ShippingCarrier;

  @Prop({ type: String })
  trackingNumber?: string;

  @Prop({ type: String })
  trackingUrl?: string;

  @Prop({ type: Date })
  estimatedDeliveryDate?: Date;

  @Prop({ type: [Object], default: [] })
  statusHistory: FulfillmentStatusHistory[];
}

export const FulfillmentSchema = SchemaFactory.createForClass(Fulfillment);
