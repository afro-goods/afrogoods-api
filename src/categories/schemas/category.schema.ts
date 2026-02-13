import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CategoryType } from '../enums/category-type.enum';

@Schema({ timestamps: true })
export class Category {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: CategoryType,
    default: CategoryType.PRODUCT,
    required: true,
    immutable: true,
  })
  type: CategoryType;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: String })
  image?: string;
}

export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Index on parentId for hierarchy queries
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ parentId: 1, name: 1, type: 1 }, { unique: true });
CategorySchema.index({ type: 1 });
