import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Advert, AdvertDocument } from './schemas/advert.schema';
import { CreateAdvertDto } from './dto/create-advert.dto';
import { UpdateAdvertDto } from './dto/update-advert.dto';
import { ReviewAdvertDto } from './dto/review-advert.dto';
import { AdvertQueryDto } from './dto/advert-query.dto';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';
import { CategoriesService } from '../categories/categories.service';
import {
  CacheService,
  CacheKeyBuilder,
  CacheTTL,
} from 'src/shared/services/cache';
import { CategoryType } from '../categories/enums/category-type.enum';
import { AdvertStatus } from './enums/advert-status.enum';
import { EmailQueueService } from '../queue/services/email-queue.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdvertsService {
  private readonly logger = new Logger(AdvertsService.name);

  /** Maximum number of active (pending/approved) adverts per user */
  private readonly MAX_ACTIVE_ADVERTS = 2;

  constructor(
    @InjectModel(Advert.name) private advertModel: Model<AdvertDocument>,
    private readonly paginationService: PaginationService,
    private readonly categoriesService: CategoriesService,
    private readonly cacheService: CacheService,
    private readonly emailQueueService: EmailQueueService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Validates that a category exists and is of type 'advert'
   * @throws BadRequestException if category is invalid
   */
  private async validateAdvertCategory(categoryId: string): Promise<void> {
    const isValid = await this.categoriesService.checkCategoryExists(
      categoryId,
      CategoryType.ADVERT,
    );

    if (!isValid) {
      throw new BadRequestException(
        'Invalid category: The specified category does not exist or is not an advert category. Please select a valid advert category.',
      );
    }
  }

  /** Create advert (customer) */
  async create(
    createAdvertDto: CreateAdvertDto,
    ownerId: string,
  ): Promise<Advert> {
    const { startDate, endDate, category } = createAdvertDto;

    // Check active adverts limit
    const activeCount = await this.advertModel.countDocuments({
      owner: new Types.ObjectId(ownerId),
      status: { $in: [AdvertStatus.PENDING, AdvertStatus.APPROVED] },
    });

    if (activeCount >= this.MAX_ACTIVE_ADVERTS) {
      throw new BadRequestException(
        `You have reached the maximum limit of ${this.MAX_ACTIVE_ADVERTS} active adverts. Please wait for existing adverts to expire or delete some before creating new ones.`,
      );
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // Validate that the category exists and is of type 'advert'
    await this.validateAdvertCategory(category);

    const advert = new this.advertModel({
      ...createAdvertDto,
      category: new Types.ObjectId(category),
      owner: new Types.ObjectId(ownerId),
      status: AdvertStatus.PENDING,
    });

    const savedAdvert = await advert.save();

    // Invalidate advert list caches
    await this.cacheService.deleteByPattern(CacheKeyBuilder.advertPattern());

    // Send confirmation email to owner (non-blocking)
    try {
      const owner = await this.usersService.findById(ownerId);
      const advertTypeLabel =
        savedAdvert.type.charAt(0).toUpperCase() + savedAdvert.type.slice(1);
      await this.emailQueueService.sendAdvertSubmittedEmail({
        email: owner.email,
        customerName: owner.firstName || owner.username || 'there',
        advertTitle: savedAdvert.title,
        advertType: advertTypeLabel,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to queue advert submitted email: ${(err as Error).message}`,
      );
    }

    return savedAdvert;
  }

  /** Review advert - approve or reject (admin) */
  async review(
    advertId: string,
    dto: ReviewAdvertDto,
    adminId: string,
  ): Promise<Advert> {
    const advert = await this.advertModel.findById(advertId);
    if (!advert) throw new NotFoundException('Advert not found');

    advert.status = dto.status;
    if (dto.status === AdvertStatus.REJECTED) {
      advert.rejectionReason = dto.rejectionReason;
    }
    advert.reviewedBy = new Types.ObjectId(adminId);

    const savedAdvert = await advert.save();

    // Invalidate all advert caches (status change affects active adverts)
    await this.cacheService.deleteByPattern(CacheKeyBuilder.advertPattern());

    // Send review outcome email to owner (approved or rejected)
    try {
      const owner = await this.usersService.findById(
        savedAdvert.owner.toString(),
      );
      await this.emailQueueService.sendAdvertReviewedEmail({
        email: owner.email,
        customerName: owner.firstName || owner.username || 'there',
        advertTitle: savedAdvert.title,
        status: dto.status,
        rejectionReason: dto.rejectionReason,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to queue advert reviewed email: ${(err as Error).message}`,
      );
    }

    return savedAdvert;
  }

  /** Hub / admin listing with pagination & filters */
  async findAll(query: AdvertQueryDto) {
    const filter: any = {};

    if (query.type) filter.type = query.type;
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.status) filter.status = query.status;
    if (query.owner) filter.owner = new Types.ObjectId(query.owner);

    return this.paginationService.paginate(this.advertModel, {
      page: query.page,
      limit: query.limit,
      filter,
      sort: { createdAt: -1 },
      populate: [
        {
          path: 'owner',
          select: 'firstName lastName email phoneNumber photoUrl',
        },
        { path: 'category', select: 'name description' },
        { path: 'reviewedBy', select: 'firstName lastName' },
      ],
    });
  }

  /** Find one advert with full details */
  async findOne(id: string): Promise<Advert> {
    // Try cache first
    const cacheKey = CacheKeyBuilder.advertSingle(id);
    const cached = await this.cacheService.get<Advert>(cacheKey);
    if (cached) return cached;

    const advert = await this.advertModel
      .findById(id)
      .populate('owner', 'firstName lastName email phoneNumber photoUrl')
      .populate('category', 'name description')
      .populate('reviewedBy', 'firstName lastName')
      .lean()
      .exec();

    if (!advert) throw new NotFoundException('Advert not found');

    // Cache the result
    await this.cacheService.set(cacheKey, advert, CacheTTL.ADVERT_SINGLE);

    return advert;
  }

  /** Update advert (customer edits their own advert) */
  async update(
    id: string,
    dto: UpdateAdvertDto,
    ownerId: string,
  ): Promise<Advert> {
    const advert = await this.advertModel.findOne({
      _id: id,
      owner: new Types.ObjectId(ownerId),
    });
    if (!advert)
      throw new NotFoundException('Advert not found or not owned by you');

    if (dto.category) {
      await this.validateAdvertCategory(dto.category);
      (dto as any).category = new Types.ObjectId(dto.category);
    }

    Object.assign(advert, dto);
    const savedAdvert = await advert.save();

    // Invalidate specific advert and list caches
    await this.cacheService.delete(CacheKeyBuilder.advertSingle(id));
    await this.cacheService.deleteByPattern(CacheKeyBuilder.advertPattern());

    return savedAdvert;
  }

  /** Delete advert (customer deletes their own advert) */
  async remove(id: string, ownerId: string): Promise<{ deleted: boolean }> {
    const res = await this.advertModel
      .deleteOne({ _id: id, owner: new Types.ObjectId(ownerId) })
      .exec();

    if (res.deletedCount > 0) {
      // Invalidate specific advert and list caches
      await this.cacheService.delete(CacheKeyBuilder.advertSingle(id));
      await this.cacheService.deleteByPattern(CacheKeyBuilder.advertPattern());
    }

    return { deleted: res.deletedCount > 0 };
  }

  /**
   * Mark expired adverts automatically
   * Runs daily at midnight to check for adverts past their endDate
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireAdverts(): Promise<number> {
    const now = new Date();
    const res = await this.advertModel.updateMany(
      { endDate: { $lt: now }, status: AdvertStatus.APPROVED },
      { status: AdvertStatus.EXPIRED, isActive: false },
    );

    if (res.modifiedCount > 0) {
      this.logger.log(`Expired ${res.modifiedCount} advert(s)`);
      // Invalidate all advert caches
      await this.cacheService.deleteByPattern(CacheKeyBuilder.advertPattern());
    }

    return res.modifiedCount;
  }
}
