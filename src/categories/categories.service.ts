import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection, Types, ClientSession } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { Advert, AdvertDocument } from '../adverts/schemas/advert.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { BatchCreateCategoryDto } from './dto/batch-create-category.dto';
import { CategoryType } from './enums/category-type.enum';
import { inTransaction } from 'src/utilities/transaction';
import { MediaService } from 'src/shared/services/media/services/media.service';
import {
  CacheService,
  CacheKeyBuilder,
  CacheTTL,
} from 'src/shared/services/cache';
import { cleanBase64 } from 'src/utilities/files';
import { FileInput } from 'src/shared/inputs/file.input';

export interface CategoryWithChildren {
  _id: string;
  name: string;
  description?: string;
  type: CategoryType;
  isActive: boolean;
  parentId: string | null;
  image?: string;
  subcategories?: CategoryWithChildren[];
  productCount?: number;
}

export interface CategoryTree {
  parents: CategoryWithChildren[];
}

export interface BatchCreateResult {
  parent: CategoryDocument;
  subcategories: CategoryDocument[];
  totalCreated: number;
}

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
    private readonly mediaService: MediaService,
    private readonly cacheService: CacheService,
  ) {}

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async uploadCategoryImage(
    image?: FileInput,
  ): Promise<string | undefined> {
    if (!image?.uri) return undefined;

    const base64Data = cleanBase64(image.uri);
    if (!base64Data) return undefined;

    const buffer = Buffer.from(base64Data, 'base64');
    const result = await this.mediaService.uploadFile(buffer, {
      folder: 'categories',
      resourceType: 'image',
    });

    return result.secure_url;
  }

  async validateParentCategory(
    parentId: string,
    session?: ClientSession,
  ): Promise<CategoryDocument> {
    const query = this.categoryModel.findById(parentId);
    if (session) query.session(session);
    const parent = await query.exec();

    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }
    if (!parent.isActive) {
      throw new BadRequestException(
        'Cannot create subcategory under inactive parent',
      );
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Cannot create subcategory under another subcategory (single-level hierarchy only)',
      );
    }
    return parent;
  }

  async hasSubcategories(
    categoryId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const query = this.categoryModel.countDocuments({
      parentId: new Types.ObjectId(categoryId),
    });
    if (session) query.session(session);
    return (await query.exec()) > 0;
  }

  async getSubcategoryCount(
    categoryId: string,
    session?: ClientSession,
  ): Promise<number> {
    const query = this.categoryModel.countDocuments({
      parentId: new Types.ObjectId(categoryId),
    });
    if (session) query.session(session);
    return query.exec();
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return await inTransaction(this.connection, async (session) => {
      const {
        name,
        description,
        isActive = true,
        type = CategoryType.PRODUCT,
        parentId,
        image,
      } = dto;

      let finalType = type;
      let finalParentId: Types.ObjectId | null = null;

      if (parentId) {
        const parent = await this.validateParentCategory(parentId, session);
        finalType = parent.type;
        finalParentId = new Types.ObjectId(parentId);

        const existingSubcategory = await this.categoryModel
          .findOne({
            name: {
              $regex: new RegExp('^' + this.escapeRegex(name) + '$', 'i'),
            },
            parentId: finalParentId,
          })
          .session(session);

        if (existingSubcategory) {
          throw new ConflictException(
            'A subcategory with this name already exists under the parent',
          );
        }
      } else {
        const existingCategory = await this.categoryModel
          .findOne({
            name: {
              $regex: new RegExp('^' + this.escapeRegex(name) + '$', 'i'),
            },
            type: finalType,
            parentId: null,
          })
          .session(session);

        if (existingCategory) {
          throw new ConflictException(
            'A ' + finalType + ' category with this name already exists',
          );
        }
      }

      const imageUrl = await this.uploadCategoryImage(image);

      const [category] = await this.categoryModel.create(
        [
          {
            name,
            description,
            isActive,
            type: finalType,
            parentId: finalParentId,
            image: imageUrl,
          },
        ],
        { session },
      );

      // Invalidate all category caches
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.categoryPattern(),
      );

      return category;
    });
  }

  async findAll(query?: CategoryQueryDto): Promise<CategoryDocument[]> {
    // Try cache first (only for simple queries without filters)
    if (!query?.type && !query?.parentsOnly) {
      const cacheKey = CacheKeyBuilder.categoryAll();
      const cached = await this.cacheService.get<CategoryDocument[]>(cacheKey);
      if (cached) return cached;
    }

    const filter: Record<string, unknown> = { isActive: true };
    if (query?.type) filter.type = query.type;
    if (query?.parentsOnly) {
      filter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
    }

    const result = await this.categoryModel
      .find(filter)
      .select('name description isActive type parentId image')
      .sort({ name: 1 })
      .lean()
      .exec();

    // Cache only simple queries
    if (!query?.type && !query?.parentsOnly) {
      const cacheKey = CacheKeyBuilder.categoryAll();
      await this.cacheService.set(cacheKey, result, CacheTTL.CATEGORY_ALL);
    }

    return result;
  }

  async findById(id: string): Promise<CategoryDocument> {
    // Try cache first
    const cacheKey = CacheKeyBuilder.categorySingle(id);
    const cached = await this.cacheService.get<CategoryDocument>(cacheKey);
    if (cached) return cached;

    const category = await this.categoryModel.findById(id).lean().exec();
    if (!category) throw new NotFoundException('Category not found');

    // Cache the result
    await this.cacheService.set(cacheKey, category, CacheTTL.CATEGORY_SINGLE);

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    return await inTransaction(this.connection, async (session) => {
      const category = await this.categoryModel.findById(id).session(session);
      if (!category) throw new NotFoundException('Category not found');

      if (dto.parentId !== undefined && dto.parentId !== null) {
        await this.validateParentCategory(dto.parentId, session);
        const nameToCheck = dto.name || category.name;
        const existingInNewParent = await this.categoryModel
          .findOne({
            name: {
              $regex: new RegExp(
                '^' + this.escapeRegex(nameToCheck) + '$',
                'i',
              ),
            },
            parentId: new Types.ObjectId(dto.parentId),
            _id: { $ne: id },
          })
          .session(session);

        if (existingInNewParent) {
          throw new ConflictException(
            'A subcategory with this name already exists under the new parent',
          );
        }
      }

      if (dto.name && dto.name !== category.name) {
        const parentId =
          dto.parentId !== undefined ? dto.parentId : category.parentId;

        if (parentId) {
          const existingSubcategory = await this.categoryModel
            .findOne({
              name: {
                $regex: new RegExp('^' + this.escapeRegex(dto.name) + '$', 'i'),
              },
              parentId: new Types.ObjectId(parentId.toString()),
              _id: { $ne: id },
            })
            .session(session);

          if (existingSubcategory) {
            throw new ConflictException(
              'A subcategory with this name already exists under the parent',
            );
          }
        } else {
          const existingCategory = await this.categoryModel
            .findOne({
              name: {
                $regex: new RegExp('^' + this.escapeRegex(dto.name) + '$', 'i'),
              },
              type: category.type,
              parentId: null,
              _id: { $ne: id },
            })
            .session(session);

          if (existingCategory) {
            throw new ConflictException(
              'A ' + category.type + ' category with this name already exists',
            );
          }
        }
      }

      if (
        dto.isActive === false &&
        category.isActive === true &&
        category.parentId === null
      ) {
        await this.categoryModel
          .updateMany({ parentId: category._id }, { isActive: false })
          .session(session);
      }

      const updateData: Record<string, unknown> = { ...dto };
      if (dto.parentId !== undefined) {
        updateData.parentId = dto.parentId
          ? new Types.ObjectId(dto.parentId)
          : null;
      }

      // Handle image upload if provided
      if (dto.image) {
        const imageUrl = await this.uploadCategoryImage(dto.image);
        if (imageUrl) {
          updateData.image = imageUrl;
        }
        delete updateData.image; // Remove FileInput from update data
        if (imageUrl) {
          await this.categoryModel.findByIdAndUpdate(
            id,
            { image: imageUrl },
            { session },
          );
        }
      }

      const updatedCategory = await this.categoryModel
        .findByIdAndUpdate(id, updateData, { new: true, session })
        .exec();

      if (!updatedCategory)
        throw new NotFoundException('Category not found after update');

      // Invalidate all category caches
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.categoryPattern(),
      );

      return updatedCategory;
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    return await inTransaction(this.connection, async (session) => {
      const category = await this.categoryModel.findById(id).session(session);
      if (!category) throw new NotFoundException('Category not found');

      if (category.parentId === null) {
        const subcategoryCount = await this.getSubcategoryCount(id, session);
        if (subcategoryCount > 0) {
          throw new ConflictException(
            'Cannot delete category "' +
              category.name +
              '" because it has ' +
              subcategoryCount +
              ' subcategory(ies). Delete subcategories first.',
          );
        }
      }

      if (category.type === CategoryType.PRODUCT) {
        const productCount = await this.productModel
          .countDocuments({ category: new Types.ObjectId(id) })
          .session(session);

        if (productCount > 0) {
          throw new ConflictException(
            'Cannot delete category "' +
              category.name +
              '" because it has ' +
              productCount +
              ' associated product(s). Please move or delete the products first.',
          );
        }
      }

      if (category.type === CategoryType.ADVERT) {
        const advertCount = await this.advertModel
          .countDocuments({ category: new Types.ObjectId(id) })
          .session(session);

        if (advertCount > 0) {
          throw new ConflictException(
            'Cannot delete category "' +
              category.name +
              '" because it has ' +
              advertCount +
              ' associated advert(s). Please move or delete the adverts first.',
          );
        }
      }

      await this.categoryModel.findByIdAndDelete(id).session(session);

      // Invalidate all category caches
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.categoryPattern(),
      );

      return { message: 'Category deleted successfully' };
    });
  }

  async batchCreate(dto: BatchCreateCategoryDto): Promise<BatchCreateResult> {
    return await inTransaction(this.connection, async (session) => {
      const {
        name,
        description,
        isActive = true,
        type = CategoryType.PRODUCT,
        image,
        subcategories = [],
      } = dto;

      // Validate subcategory names are unique within the request
      if (subcategories.length > 0) {
        const names = subcategories.map((s) => s.name.toLowerCase());
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
          const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
          throw new BadRequestException(
            'Duplicate subcategory names found: ' +
              [...new Set(duplicates)].join(', '),
          );
        }
      }

      // Check if parent category already exists
      const existingCategory = await this.categoryModel
        .findOne({
          name: { $regex: new RegExp('^' + this.escapeRegex(name) + '$', 'i') },
          type,
          parentId: null,
        })
        .session(session);

      if (existingCategory) {
        throw new ConflictException(
          'A ' + type + ' category with this name already exists',
        );
      }

      // Upload parent image if provided
      const parentImageUrl = await this.uploadCategoryImage(image);

      // Create parent category
      const [parent] = await this.categoryModel.create(
        [
          {
            name,
            description,
            isActive,
            type,
            parentId: null,
            image: parentImageUrl,
          },
        ],
        { session },
      );

      // Create subcategories
      const createdSubcategories: CategoryDocument[] = [];
      for (const sub of subcategories) {
        // Upload subcategory image if provided
        const subImageUrl = await this.uploadCategoryImage(sub.image);

        const [subcategory] = await this.categoryModel.create(
          [
            {
              name: sub.name,
              description: sub.description,
              isActive,
              type,
              parentId: parent._id,
              image: subImageUrl,
            },
          ],
          { session },
        );
        createdSubcategories.push(subcategory);
      }

      // Invalidate all category caches
      await this.cacheService.deleteByPattern(
        CacheKeyBuilder.categoryPattern(),
      );

      return {
        parent,
        subcategories: createdSubcategories,
        totalCreated: 1 + createdSubcategories.length,
      };
    });
  }

  async findParentCategories(type?: CategoryType): Promise<CategoryDocument[]> {
    // Try cache first
    const cacheKey = CacheKeyBuilder.categoryParents(type);
    const cached = await this.cacheService.get<CategoryDocument[]>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, unknown> = {
      $or: [{ parentId: null }, { parentId: { $exists: false } }],
      isActive: true,
    };
    if (type) filter.type = type;

    const result = await this.categoryModel
      .find(filter)
      .select('name description isActive type parentId image')
      .sort({ name: 1 })
      .lean()
      .exec();

    // Cache the result
    await this.cacheService.set(cacheKey, result, CacheTTL.CATEGORY_PARENTS);

    return result;
  }

  async findSubcategories(parentId: string): Promise<CategoryDocument[]> {
    // Try cache first
    const cacheKey = CacheKeyBuilder.categorySubcategories(parentId);
    const cached = await this.cacheService.get<CategoryDocument[]>(cacheKey);
    if (cached) return cached;

    const result = await this.categoryModel
      .find({ parentId: new Types.ObjectId(parentId), isActive: true })
      .select('name description isActive type parentId image')
      .sort({ name: 1 })
      .lean()
      .exec();

    // Cache the result
    await this.cacheService.set(
      cacheKey,
      result,
      CacheTTL.CATEGORY_SUBCATEGORIES,
    );

    return result;
  }

  async getCategoryTree(type?: CategoryType): Promise<CategoryTree> {
    // Try cache first
    const cacheKey = CacheKeyBuilder.categoryTree(type);
    const cached = await this.cacheService.get<CategoryTree>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, unknown> = { isActive: true };
    if (type) filter.type = type;

    const allCategories = await this.categoryModel
      .find(filter)
      .select('name description isActive type parentId image')
      .sort({ name: 1 })
      .lean()
      .exec();

    const productCounts = await this.productModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      productCounts.map((p) => [p._id?.toString(), p.count]),
    );

    const parentCategories = allCategories.filter((c) => !c.parentId);
    const subcategoriesMap = new Map<string, CategoryDocument[]>();

    allCategories
      .filter((c) => c.parentId)
      .forEach((c) => {
        const parentIdStr = c.parentId!.toString();
        if (!subcategoriesMap.has(parentIdStr))
          subcategoriesMap.set(parentIdStr, []);
        subcategoriesMap.get(parentIdStr)!.push(c);
      });

    const parents: CategoryWithChildren[] = parentCategories.map((parent) => {
      const parentIdStr = (parent as any)._id.toString();
      const subs = subcategoriesMap.get(parentIdStr) || [];

      return {
        _id: parentIdStr,
        name: parent.name,
        description: parent.description,
        type: parent.type,
        isActive: parent.isActive,
        parentId: null,
        image: parent.image,
        productCount: countMap.get(parentIdStr) || 0,
        subcategories: subs.map((sub) => ({
          _id: (sub as any)._id.toString(),
          name: sub.name,
          description: sub.description,
          type: sub.type,
          isActive: sub.isActive,
          parentId: parentIdStr,
          image: sub.image,
          productCount: countMap.get((sub as any)._id.toString()) || 0,
          subcategories: [],
        })),
      };
    });

    const result = { parents };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CacheTTL.CATEGORY_TREE);

    return result;
  }

  async findByIdWithSubcategories(id: string): Promise<CategoryWithChildren> {
    const category = await this.findById(id);
    const subcategories = await this.findSubcategories(id);
    const productCount = await this.getProductCount(id);

    return {
      _id: (category as any)._id.toString(),
      name: category.name,
      description: category.description,
      type: category.type,
      isActive: category.isActive,
      parentId: category.parentId?.toString() || null,
      image: category.image,
      productCount,
      subcategories: await Promise.all(
        subcategories.map(async (sub) => ({
          _id: (sub as any)._id.toString(),
          name: sub.name,
          description: sub.description,
          type: sub.type,
          isActive: sub.isActive,
          parentId: id,
          image: sub.image,
          productCount: await this.getProductCount((sub as any)._id.toString()),
          subcategories: [],
        })),
      ),
    };
  }

  async checkCategoryExists(id: string, type?: CategoryType): Promise<boolean> {
    const category = await this.categoryModel.findById(id).lean().exec();
    if (!category || !category.isActive) return false;
    if (type && category.type !== type) return false;
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
