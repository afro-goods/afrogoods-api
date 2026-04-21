import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliverySettingsDocument = DeliverySettings & Document;

@Schema({ timestamps: true })
export class DeliverySettings {
  @Prop({ type: Boolean, default: false })
  deliveryAvailabilityEnabled: boolean;

  @Prop({ type: String })
  calendlyApiTokenEncrypted: string;

  @Prop({ type: String })
  calendlyEventTypeUri: string;

  @Prop({ type: Number, default: 60 })
  cacheDurationMinutes: number;
}

export const DeliverySettingsSchema =
  SchemaFactory.createForClass(DeliverySettings);
