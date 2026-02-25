import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliverySettingsDocument = DeliverySettings & Document;

@Schema({ timestamps: true })
export class DeliverySettings {
  @Prop({ default: false })
  deliveryAvailabilityEnabled: boolean;

  @Prop()
  calendlyApiTokenEncrypted: string;

  @Prop()
  calendlyEventTypeUri: string;

  @Prop({ default: 60 })
  cacheDurationMinutes: number;
}

export const DeliverySettingsSchema = SchemaFactory.createForClass(DeliverySettings);
