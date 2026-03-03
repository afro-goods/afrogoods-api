import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';
import { DeliveryTimeUnit } from '../../product/enums/delivery-time-unit.enum';

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  priceAtPurchase: number;

  @Prop({ type: Object, default: {} })
  selectedAttributes?: Record<string, string>;

  @Prop({ type: String, enum: DeliveryTimeUnit })
  deliveryTimeUnit?: DeliveryTimeUnit;

  @Prop({ type: Number })
  deliveryMinTime?: number;

  @Prop({ type: Number })
  deliveryMaxTime?: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
