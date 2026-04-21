import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({ timestamps: true })
export class WebhookEvent {
  @Prop({ type: String, required: true, unique: true })
  eventId: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: String })
  paymentIntentId?: string;

  @Prop({ type: Boolean, default: false })
  processed: boolean;

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: String })
  error?: string;

  @Prop({ type: Object })
  rawEvent?: any;

  @Prop({ type: Number, default: 0 })
  retryCount: number;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);
WebhookEventSchema.index({ eventId: 1 }, { unique: true });
