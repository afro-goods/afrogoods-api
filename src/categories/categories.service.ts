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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
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
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return await inTransaction(this.connection, async (session) => {
      try {
        const { name, description, isActive = true } = dto;

        const existingCategory = await this.categoryModel
          .findOne({ name: new RegExp(`^${name}$`, 'i') })
          .session(session);

        if (existingCategory) {
          throw new ConflictException('Category with this name already exists');
        }

        const [category] = await this.categoryModel.create(
          [
            {
              name,
              description,
              isActive,
            },
          ],
          { session },
        );

        return category;
      } catch (error) {
        if (error.code === 11000) {
          throw new ConflictException('Category with this name already exists');
        }

        if (error instanceof ConflictException) {
          throw error;
        }

        throw new BadRequestException('Failed to create category');
      }
    });
  }

  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ isActive: true })
      .select('name description isActive')
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
        const existingCategory = await this.categoryModel
          .findOne({
            name: new RegExp(`^${dto.name}$`, 'i'),
            _id: { $ne: id },
          })
          .session(session);

        if (existingCategory) {
          throw new ConflictException('Category with this name already exists');
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

      const productCount = await this.productModel
        .countDocuments({ category: new Types.ObjectId(id) })
        .session(session);

      if (productCount > 0) {
        throw new ConflictException(
          `Cannot delete category "${category.name}" because it has ${productCount} associated product(s). Please move or delete the products first.`,
        );
      }

      await this.categoryModel.findByIdAndDelete(id).session(session);

      return { message: 'Category deleted successfully' };
    });
  }

  async checkCategoryExists(id: string): Promise<boolean> {
    const category = await this.categoryModel.findById(id).lean().exec();
    return !!category && category.isActive;
  }

  async getProductCount(categoryId: string): Promise<number> {
    return this.productModel
      .countDocuments({ category: new Types.ObjectId(categoryId) })
      .exec();
  }

  async getCategoryWithProductCount(
    id: string,
  ): Promise<
    { productCount: number } & Pick<
      CategoryDocument,
      'name' | 'description' | 'isActive' | '_id'
    >
  > {
    const category = await this.findById(id);
    const productCount = await this.getProductCount(id);

    return {
      _id: category._id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      productCount,
    };
  }
}
