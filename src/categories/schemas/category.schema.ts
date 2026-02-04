import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
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
}

export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Compound unique index: name must be unique within each type
CategorySchema.index({ name: 1, type: 1 }, { unique: true });

// Index on type field for query optimization
CategorySchema.index({ type: 1 });
