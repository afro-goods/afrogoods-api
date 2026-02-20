import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PaymentSettings extends Document {
  @Prop({ type: String, required: true, default: 'default', unique: true })
  settingsType: string;

  @Prop({ type: String, required: true, trim: true })
  eTransferEmail: string;

  @Prop({ type: String, required: true, trim: true })
  whatsappNumber: string;

  @Prop({ type: String, trim: true })
  paymentInstructions?: string;

  // Delivery fee settings
  @Prop({ type: Number, required: true, default: 15.00 })
  expressDeliveryFee: number;

  @Prop({ type: Number, required: true, default: 8.00 })
  standardDeliveryFee: number;

  // Currency setting
  @Prop({ type: String, required: true, default: 'CAD', trim: true })
  currency: string;
}

export type PaymentSettingsDocument = PaymentSettings & Document;
export const PaymentSettingsSchema =
  SchemaFactory.createForClass(PaymentSettings);
