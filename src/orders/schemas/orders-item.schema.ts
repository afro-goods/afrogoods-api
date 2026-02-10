import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';
import { DeliveryTimeUnit } from '../../product/enums/delivery-time-unit.enum';

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  priceAtPurchase: number;

  // Delivery timeline captured at purchase time
  @Prop({ type: String, enum: DeliveryTimeUnit })
  deliveryTimeUnit?: DeliveryTimeUnit;

  @Prop({ type: Number })
  deliveryMinTime?: number;

  @Prop({ type: Number })
  deliveryMaxTime?: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
