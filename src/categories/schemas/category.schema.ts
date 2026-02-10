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

  // Optional parent reference for subcategories (null = parent category)
  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId: Types.ObjectId | null;

  // Optional image for category display
  @Prop({ type: String })
  image?: string;
}

export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Index on parentId for hierarchy queries
CategorySchema.index({ parentId: 1 });

// Compound unique index: name must be unique within parent scope and type
// For parent categories (parentId: null), name must be unique within type
// For subcategories, name must be unique within the same parent
CategorySchema.index({ parentId: 1, name: 1, type: 1 }, { unique: true });

// Index on type field for query optimization
CategorySchema.index({ type: 1 });
