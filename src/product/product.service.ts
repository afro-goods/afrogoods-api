import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './schemas/product.schema';
import { Category } from './schemas/category.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';
import { MediaService } from 'src/shared/services/media/services/media.service';
import { inTransaction } from 'src/utilities/transaction';
import { cleanBase64 } from 'src/utilities/files';
import { Connection } from 'mongoose';

@Injectable()
export class ProductsService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @InjectModel(Product.name)
    private productModel: Model<Product>,
    @InjectModel(Category.name)
    private categoryModel: Model<Category>,
    private readonly paginationService: PaginationService,
    private readonly mediaService: MediaService,
  ) {}

  // ---------- CATEGORY ----------
  async createCategory(dto: CreateCategoryDto) {
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

  async findAllCategories() {
    return this.categoryModel
      .find({ isActive: true })
      .select('name description')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async deleteCategory(id: string) {
    return await inTransaction(this.connection, async (session) => {
      const category = await this.categoryModel.findById(id).session(session);
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const productCount = await this.productModel
        .countDocuments({ category: id })
        .session(session);

      if (productCount > 0) {
        throw new ConflictException(
          `Cannot delete category. ${productCount} product(s) are using it.`,
        );
      }

      await this.categoryModel.findByIdAndDelete(id).session(session);

      return { message: 'Category deleted successfully' };
    });
  }

  // ---------- PRODUCT ----------
  async createProduct(dto: CreateProductDto) {
    return await inTransaction(this.connection, async (session) => {
      try {
        const category = await this.categoryModel
          .findById(dto.category)
          .session(session);
        if (!category) throw new NotFoundException('Category not found');
        if (!category.isActive)
          throw new ConflictException('Category is inactive');

        let imageUrls: string[] = [];

        if (dto.images && dto.images.length > 0) {
          const uploadPromises = dto.images.map(async (img) => {
            const base64Data = cleanBase64(img.uri);
            if (!base64Data) return null;

            const buffer = Buffer.from(base64Data, 'base64');

            const result = await this.mediaService.uploadFile(buffer, {
              folder: 'products',
              resourceType: 'image',
            });

            return result.secure_url;
          });

          const urls = (await Promise.all(uploadPromises)).filter(
            Boolean,
          ) as string[];
          imageUrls = urls;
        }

        const [product] = await this.productModel.create(
          [
            {
              ...dto,
              images: imageUrls,
              category: dto.category,
            },
          ],
          { session },
        );

        await product.populate('category', 'name description isActive');

        return product;
      } catch (error) {
        console.warn(
          'Product creation failed — uploaded images remain in Cloudinary (no public_id stored)',
        );
        throw error;
      }
    });
  }

  async findAllProducts(query: ProductQueryDto) {
    const { page, limit, search, category, sort } = query;

    const filter: any = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    return this.paginationService.paginate(this.productModel, {
      page,
      limit,
      filter,
      sort:
        sort === 'price'
          ? { price: 1 }
          : sort === '-price'
            ? { price: -1 }
            : { createdAt: -1 },
      populate: { path: 'category', select: 'name' },
    });
  }

  async findProductById(id: string) {
    const product = await this.productModel
      .findById(id)
      .populate('category', 'name description isActive')
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    return await inTransaction(this.connection, async (session) => {
      try {
        const product = await this.productModel.findById(id).session(session);

        if (!product) {
          throw new NotFoundException('Product not found');
        }

        const { images, ...fieldsToUpdate } = dto;

        let imageUrlsToSave = product.images;

        if (images !== undefined) {
          if (images.length === 0) {
            imageUrlsToSave = [];
          } else {
            const uploadPromises = images.map(async (img) => {
              const base64Data = cleanBase64(img.uri);
              if (!base64Data) return null;

              const buffer = Buffer.from(base64Data, 'base64');

              const result = await this.mediaService.uploadFile(buffer, {
                folder: 'products',
                resourceType: 'image',
              });

              return result.secure_url;
            });

            const uploadedUrls = (await Promise.all(uploadPromises)).filter(
              Boolean,
            ) as string[];

            imageUrlsToSave = uploadedUrls;
          }
        }

        const updatedProduct = await this.productModel
          .findByIdAndUpdate(
            id,
            {
              ...fieldsToUpdate,
              images: imageUrlsToSave,
            },
            { new: true, session },
          )
          .populate('category', 'name description isActive');

        return updatedProduct;
      } catch (error) {
        console.warn('Product update failed');
        throw error;
      }
    });
  }

  async deleteProduct(id: string) {
    return await inTransaction(this.connection, async (session) => {
      const product = await this.productModel.findById(id).session(session);

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      await this.productModel.findByIdAndDelete(id).session(session);

      return { message: 'Product deleted successfully' };
    });
  }
}
