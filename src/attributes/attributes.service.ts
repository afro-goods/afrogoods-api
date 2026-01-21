import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  ProductAttribute,
  ProductAttributeDocument,
} from './schemas/product-attribute.schema';
import { AttributeType } from './enums/attribute.enum';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';

@Injectable()
export class AttributesService {
  constructor(
    @InjectModel(ProductAttribute.name)
    private productAttributeModel: Model<ProductAttributeDocument>,
  ) {}

  /**
   * Create product attributes during product creation
   */
  async createProductAttributes(
    productId: Types.ObjectId,
    attributesData: CreateProductAttributeDto[],
    session?: ClientSession,
  ): Promise<ProductAttributeDocument[]> {
    const attributesToCreate = attributesData.map((attrData, index) => ({
      productId,
      name: attrData.title,
      type: attrData.type,
      value: this.processAttributeValue(attrData),
      options: this.extractOptions(attrData),
      metadata: {
        isRequired: attrData.required || false,
        displayOrder: index,
      },
    }));

    const createdAttributes = await this.productAttributeModel.insertMany(
      attributesToCreate,
      { session },
    );

    return createdAttributes as ProductAttributeDocument[];
  }

  /**
   * Get all attributes for a product
   */
  async getProductAttributes(
    productId: string,
  ): Promise<ProductAttributeDocument[]> {
    return this.productAttributeModel
      .find({ productId: new Types.ObjectId(productId) })
      .sort({ 'metadata.displayOrder': 1, name: 1 })
      .exec();
  }

  /**
   * Update product attributes
   */
  async updateProductAttributes(
    productId: Types.ObjectId,
    attributesData: CreateProductAttributeDto[],
    session?: ClientSession,
  ): Promise<ProductAttributeDocument[]> {
    await this.productAttributeModel.deleteMany({ productId }, { session });
    return this.createProductAttributes(productId, attributesData, session);
  }

  /**
   * Delete all attributes for a product
   */
  async deleteProductAttributes(
    productId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.productAttributeModel.deleteMany({ productId }, { session });
  }

  /**
   * Process attribute value based on type
   */
  private processAttributeValue(attrData: CreateProductAttributeDto): any {
    switch (attrData.type) {
      case AttributeType.SINGLE:
        return attrData.options?.[0]?.name || null;
      case AttributeType.MULTIPLE:
        return attrData.options?.map((opt) => opt.name) || [];
      default:
        return attrData.options?.[0]?.name || '';
    }
  }

  /**
   * Extract options for single/multiple attributes
   */
  private extractOptions(attrData: CreateProductAttributeDto): any[] {
    if (
      attrData.type === AttributeType.SINGLE ||
      attrData.type === AttributeType.MULTIPLE
    ) {
      return attrData.options || [];
    }
    return [];
  }
}
