import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';
import { MediaService } from 'src/shared/services/media/services/media.service';
import { AttributesService } from '../attributes/attributes.service';
import { CategoriesService } from '../categories/categories.service';
import {
  CacheService,
  CacheKeyBuilder,
  CacheTTL,
} from 'src/shared/services/cache';
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
    private readonly paginationService: PaginationService,
    private readonly mediaService: MediaService,
    private readonly attributesService: AttributesService,
    private readonly categoriesService: CategoriesService,
    private readonly cacheService: CacheService,
  ) {}

  async createProduct(dto: CreateProductDto) {
    return await inTransaction(this.connection, async (session) => {
      const categoryExists = await this.categoriesService.checkCategoryExists(
        dto.category,
      );
      if (!categoryExists) {
        throw new NotFoundException('Category not found or inactive');
      }

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

      const productData: any = {
        name: dto.name,
        description: dto.description,
        category: new Types.ObjectId(dto.category),
        price: dto.price,
        stock: dto.stock,
        currency: 'CAD',
        images: imageUrls,
        availabilityStatus: dto.availabilityStatus || 'In Stock',
        brand: dto.brand,
        weight: dto.weight,
        isFrozen: dto.isFrozen,
        isOrganic: dto.isOrganic,
        tags: dto.tags || [],
        deliveryTimeUnit: dto.deliveryTimeUnit,
        deliveryMinTime: dto.deliveryMinTime,
        deliveryMaxTime: dto.deliveryMaxTime,
        deliveryNote: dto.deliveryNote,
        requiresScheduledDelivery: dto.requiresScheduledDelivery ?? false,
      };

      const [product] = await this.productModel.create([productData], {
        session,
      });

      // Create attributes using attributes service
      let attributeIds: Types.ObjectId[] = [];
      if (dto.attributes && dto.attributes.length > 0) {
        const createdAttributes =
          await this.attributesService.createProductAttributes(
            product._id,
            dto.attributes,
            session,
          );
        attributeIds = createdAttributes.map((attr) => attr._id);
      }

      // Update product with attribute references
      if (attributeIds.length > 0) {
        await this.productModel.findByIdAndUpdate(
          product._id,
          { attributes: attributeIds },
          { session, new: true },
        );
      }

      // Populate and return
      const populatedProduct = await this.productModel
        .findById(product._id)
        .populate('category', 'name description isActive')
        .populate('attributes')
        .session(session);

      // Invalidate product list caches
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.productListPattern(),
      );
      await this.cacheService.deleteByPattern('products:featured:*');

      return populatedProduct;
    });
  }

  async findAllProducts(query: ProductQueryDto) {
    const { page, limit, search, category, sort } = query;

    // Only cache non-search queries (search results are too dynamic)
    if (!search) {
      const cacheKey = CacheKeyBuilder.productList(
        page || 1,
        limit || 10,
        category,
      );
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const filter: any = {
      availabilityStatus: { $in: ['Draft', 'Out of Stock', 'In Stock'] },
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      // Check if this is a parent category with subcategories
      const subcategories =
        await this.categoriesService.findSubcategories(category);

      if (subcategories.length > 0) {
        // Include products from parent category AND all subcategories
        const categoryIds = [
          new Types.ObjectId(category),
          ...subcategories.map((sub) => new Types.ObjectId((sub as any)._id)),
        ];
        filter.category = { $in: categoryIds };
      } else {
        // No subcategories, filter by this category only
        filter.category = new Types.ObjectId(category);
      }
    }

    const result = await this.paginationService.paginate(this.productModel, {
      page,
      limit,
      filter,
      sort:
        sort === 'price'
          ? { price: 1 }
          : sort === '-price'
            ? { price: -1 }
            : { createdAt: -1 },
      populate: [
        { path: 'category', select: 'name description isActive parentId' },
        { path: 'attributes' },
      ],
    });

    // Cache non-search results
    if (!search) {
      const cacheKey = CacheKeyBuilder.productList(
        page || 1,
        limit || 10,
        category,
      );
      await this.cacheService.set(cacheKey, result, CacheTTL.PRODUCT_LIST);
    }

    return result;
  }

  async findAllProductsIncludingArchived(query: ProductQueryDto) {
    const { page, limit, search, category, sort } = query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    const result = await this.paginationService.paginate(this.productModel, {
      page,
      limit,
      filter,
      sort:
        sort === 'price'
          ? { price: 1 }
          : sort === '-price'
            ? { price: -1 }
            : { createdAt: -1 },
      populate: [
        { path: 'category', select: 'name description isActive' },
        { path: 'attributes' },
      ],
    });

    return result;
  }

  async findProductById(id: string) {
    // Try cache first
    const cacheKey = CacheKeyBuilder.productSingle(id);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productModel
      .findById(id)
      .populate('category', 'name description isActive')
      .populate('attributes')
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Cache the result
    await this.cacheService.set(cacheKey, product, CacheTTL.PRODUCT_SINGLE);

    return product;
  }

  async getFeaturedProducts(limit: number = 8) {
    // Try cache first
    const cacheKey = `products:featured:${limit}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Return products that are in stock, sorted by newest first
    // In the future, this can be enhanced to sort by sales count once order tracking is implemented
    const products = await this.productModel
      .find({
        availabilityStatus: 'In Stock',
      })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 20)) // Cap at 20 max
      .populate('category', 'name description isActive')
      .lean()
      .exec();

    // Cache the result
    await this.cacheService.set(cacheKey, products, CacheTTL.PRODUCT_LIST);

    return products;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    return await inTransaction(this.connection, async (session) => {
      const product = await this.productModel.findById(id).session(session);

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Validate category if being updated
      if (dto.category) {
        const categoryExists = await this.categoriesService.checkCategoryExists(
          dto.category,
        );
        if (!categoryExists) {
          throw new NotFoundException('Category not found or inactive');
        }
      }

      const { images, attributes, ...fieldsToUpdate } = dto;

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

      // Update attributes if provided
      let attributeIds = product.attributes;
      if (attributes !== undefined) {
        if (attributes.length === 0) {
          // Delete all attributes
          await this.attributesService.deleteProductAttributes(
            product._id,
            session,
          );
          attributeIds = [];
        } else {
          // Update attributes
          const updatedAttributes =
            await this.attributesService.updateProductAttributes(
              product._id,
              attributes,
              session,
            );
          attributeIds = updatedAttributes.map((attr) => attr._id);
        }
      }

      const updateData: any = {
        ...fieldsToUpdate,
        images: imageUrlsToSave,
        attributes: attributeIds,
      };

      if (dto.category) {
        updateData.category = new Types.ObjectId(dto.category);
      }

      const updatedProduct = await this.productModel
        .findByIdAndUpdate(id, updateData, { new: true, session })
        .populate('category', 'name description isActive')
        .populate('attributes');

      // Invalidate caches: specific product + all list caches
      await this.cacheService.delete(CacheKeyBuilder.productSingle(id));
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.productListPattern(),
      );
      await this.cacheService.deleteByPattern('products:featured:*');

      return updatedProduct;
    });
  }

  async deleteProduct(id: string) {
    return await inTransaction(this.connection, async (session) => {
      const product = await this.productModel.findById(id).session(session);

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Delete associated attributes
      await this.attributesService.deleteProductAttributes(
        product._id,
        session,
      );

      await this.productModel.findByIdAndDelete(id).session(session);

      // Invalidate caches: specific product + all list caches
      await this.cacheService.delete(CacheKeyBuilder.productSingle(id));
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.productListPattern(),
      );
      await this.cacheService.deleteByPattern('products:featured:*');

      return { message: 'Product deleted successfully' };
    });
  }
}
