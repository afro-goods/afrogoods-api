import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AdvertStatus } from '../enums/advert-status.enum';
import { AdvertType } from '../enums/advert-type.enum';
import { AdvertTargetType } from '../enums/advert-target-type.enum';

@Schema({ timestamps: true })
export class Advert extends Document {
  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: AdvertType,
    index: true,
  })
  type: AdvertType;

  @Prop({
    type: Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: AdvertTargetType,
  })
  targetType: AdvertTargetType;

  @Prop({ type: String, required: true })
  targetValue: string;

  @Prop({
    type: String,
    enum: AdvertStatus,
    default: AdvertStatus.PENDING,
    index: true,
  })
  status: AdvertStatus;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, required: false, index: true })
  startDate?: Date;

  @Prop({ type: Date, required: false, index: true })
  endDate?: Date;

  @Prop({ type: String, trim: true, index: true })
  location?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isFeatured: boolean;

  @Prop({ type: Number, default: 0 })
  clickCount: number;
}

export type AdvertDocument = Advert & Document;

export const AdvertSchema = SchemaFactory.createForClass(Advert);

/* ---------- Indexes ---------- */
AdvertSchema.index({ status: 1, isActive: 1 });
AdvertSchema.index({ type: 1, category: 1 });
AdvertSchema.index({ startDate: 1, endDate: 1 });
AdvertSchema.index({ owner: 1, createdAt: -1 });
