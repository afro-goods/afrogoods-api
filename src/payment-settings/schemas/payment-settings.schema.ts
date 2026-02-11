import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PaymentSettings extends Document {
  @Prop({ required: true, default: 'default', unique: true })
  settingsType: string;

  @Prop({ required: true, trim: true })
  eTransferEmail: string;

  @Prop({ required: true, trim: true })
  whatsappNumber: string;

  @Prop({ trim: true })
  paymentInstructions?: string;
}

export type PaymentSettingsDocument = PaymentSettings & Document;
export const PaymentSettingsSchema =
  SchemaFactory.createForClass(PaymentSettings);
