import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { AttributeType } from '../enums/attribute.enum';

export type ProductAttributeDocument = ProductAttribute & Document;

@Schema({ _id: false })
export class AttributeOption {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, required: true, default: 0 })
  price: number;
}

export const AttributeOptionSchema =
  SchemaFactory.createForClass(AttributeOption);

@Schema({ timestamps: true })
export class ProductAttribute {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: AttributeType,
    required: true,
  })
  type: AttributeType;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: unknown;

  @Prop({ type: [AttributeOptionSchema], default: [] })
  options: AttributeOption[];

  @Prop({
    type: {
      isRequired: { type: Boolean, default: false },
      displayOrder: { type: Number, default: 0 },
    },
    default: {},
  })
  metadata: {
    isRequired: boolean;
    displayOrder: number;
  };
}

export const ProductAttributeSchema =
  SchemaFactory.createForClass(ProductAttribute);

ProductAttributeSchema.index({ productId: 1 });
