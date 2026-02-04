import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { Advert, AdvertDocument } from '../adverts/schemas/advert.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryType } from './enums/category-type.enum';
import { inTransaction } from 'src/utilities/transaction';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Advert.name)
    private advertModel: Model<AdvertDocument>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return await inTransaction(this.connection, async (session) => {
      try {
        const {
          name,
          description,
          isActive = true,
          type = CategoryType.PRODUCT,
        } = dto;

        // Check for unique name within the same type (case-insensitive)
        const existingCategory = await this.categoryModel
          .findOne({
            name: new RegExp(`^${name}$`, 'i'),
            type,
          })
          .session(session);

        if (existingCategory) {
          throw new ConflictException(
            `A ${type} category with this name already exists`,
          );
        }

        const [category] = await this.categoryModel.create(
          [
            {
              name,
              description,
              isActive,
              type,
            },
          ],
          { session },
        );

        return category;
      } catch (error) {
        if (error.code === 11000) {
          throw new ConflictException(
            'Category with this name already exists for this type',
          );
        }

        if (error instanceof ConflictException) {
          throw error;
        }

        throw new BadRequestException('Failed to create category');
      }
    });
  }

  async findAll(query?: CategoryQueryDto): Promise<CategoryDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };

    // Filter by type when provided
    if (query?.type) {
      filter.type = query.type;
    }

    return this.categoryModel
      .find(filter)
      .select('name description isActive type')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(id).lean().exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    return await inTransaction(this.connection, async (session) => {
      const category = await this.categoryModel.findById(id).session(session);

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      if (dto.name && dto.name !== category.name) {
        // Check for unique name within the same type (case-insensitive)
        const existingCategory = await this.categoryModel
          .findOne({
            name: new RegExp(`^${dto.name}$`, 'i'),
            type: category.type,
            _id: { $ne: id },
          })
          .session(session);

        if (existingCategory) {
          throw new ConflictException(
            `A ${category.type} category with this name already exists`,
          );
        }
      }

      const updatedCategory = await this.categoryModel
        .findByIdAndUpdate(id, dto, { new: true, session })
        .exec();

      if (!updatedCategory) {
        throw new NotFoundException('Category not found after update');
      }

      return updatedCategory;
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    return await inTransaction(this.connection, async (session) => {
      const category = await this.categoryModel.findById(id).session(session);

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      // Check for associated products (for product categories)
      if (category.type === CategoryType.PRODUCT) {
        const productCount = await this.productModel
          .countDocuments({ category: new Types.ObjectId(id) })
          .session(session);

        if (productCount > 0) {
          throw new ConflictException(
            `Cannot delete category "${category.name}" because it has ${productCount} associated product(s). Please move or delete the products first.`,
          );
        }
      }

      // Check for associated adverts (for advert categories)
      if (category.type === CategoryType.ADVERT) {
        const advertCount = await this.advertModel
          .countDocuments({ category: new Types.ObjectId(id) })
          .session(session);

        if (advertCount > 0) {
          throw new ConflictException(
            `Cannot delete category "${category.name}" because it has ${advertCount} associated advert(s). Please move or delete the adverts first.`,
          );
        }
      }

      await this.categoryModel.findByIdAndDelete(id).session(session);

      return { message: 'Category deleted successfully' };
    });
  }

  /**
   * Check if a category exists and is active.
   * @param id - The category ID to check
   * @param type - Optional type to validate the category is of the expected type
   * @returns true if the category exists, is active, and matches the type (if provided)
   */
  async checkCategoryExists(id: string, type?: CategoryType): Promise<boolean> {
    const category = await this.categoryModel.findById(id).lean().exec();

    if (!category || !category.isActive) {
      return false;
    }

    // If type is provided, validate the category is of the expected type
    if (type && category.type !== type) {
      return false;
    }

    return true;
  }

  async getProductCount(categoryId: string): Promise<number> {
    return this.productModel
      .countDocuments({ category: new Types.ObjectId(categoryId) })
      .exec();
  }

  async getAdvertCount(categoryId: string): Promise<number> {
    return this.advertModel
      .countDocuments({ category: new Types.ObjectId(categoryId) })
      .exec();
  }

  async getCategoryWithProductCount(
    id: string,
  ): Promise<
    { productCount: number } & Pick<
      CategoryDocument,
      'name' | 'description' | 'isActive' | '_id' | 'type'
    >
  > {
    const category = await this.findById(id);
    const productCount = await this.getProductCount(id);

    return {
      _id: category._id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      type: category.type,
      productCount,
    };
  }
}
