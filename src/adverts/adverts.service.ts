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
import { CategoryType } from '../categories/enums/category-type.enum';
import { AdvertStatus } from './enums/advert-status.enum';
import { EmailService } from '../shared/services/email/email.service';

@Injectable()
export class AdvertsService {
  private readonly logger = new Logger(AdvertsService.name);

  /** Maximum number of active (pending/approved) adverts per user */
  private readonly MAX_ACTIVE_ADVERTS = 2;

  /** Minimum advert duration in days */
  private readonly MIN_ADVERT_DURATION_DAYS = 1;

  /** Maximum advert duration in days */
  private readonly MAX_ADVERT_DURATION_DAYS = 30;

  /** Statuses that allow user updates */
  private readonly UPDATABLE_STATUSES = [
    AdvertStatus.PENDING,
    AdvertStatus.REJECTED,
  ];

  /** Statuses that allow user deletion */
  private readonly DELETABLE_STATUSES = [
    AdvertStatus.PENDING,
    AdvertStatus.REJECTED,
  ];

  constructor(
    @InjectModel(Advert.name) private advertModel: Model<AdvertDocument>,
    private readonly paginationService: PaginationService,
    private readonly categoriesService: CategoriesService,
    private readonly emailService: EmailService,
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

  /**
   * Validates the duration between startDate and endDate
   * @param startDate - The advert start date
   * @param endDate - The advert end date
   * @returns Validation result with error message if invalid
   */
  private validateDateDuration(
    startDate: Date,
    endDate: Date,
  ): { isValid: boolean; error?: string } {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate duration in days
    const durationMs = end.getTime() - start.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    if (durationDays < this.MIN_ADVERT_DURATION_DAYS) {
      return {
        isValid: false,
        error: `Advert duration must be at least ${this.MIN_ADVERT_DURATION_DAYS} day.`,
      };
    }

    if (durationDays > this.MAX_ADVERT_DURATION_DAYS) {
      return {
        isValid: false,
        error: `Advert duration cannot exceed ${this.MAX_ADVERT_DURATION_DAYS} days.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validates that the start date is today or in the future
   * @param startDate - The advert start date
   * @returns True if startDate is today or future, false if in the past
   */
  private isStartDateValid(startDate: Date): boolean {
    const start = new Date(startDate);
    const today = new Date();

    // Set today to midnight for comparison
    today.setHours(0, 0, 0, 0);

    // Set start date to midnight for comparison
    start.setHours(0, 0, 0, 0);

    return start >= today;
  }

  /**
   * Checks if an advert is currently active (current date is between startDate and endDate)
   * @param advert - The advert document to check
   * @returns True if the advert is currently active, false otherwise
   */
  private isAdvertCurrentlyActive(advert: AdvertDocument): boolean {
    const now = new Date();
    const start = new Date(advert.startDate);
    const end = new Date(advert.endDate);

    // Set all dates to midnight for consistent comparison
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if current date is between startDate and endDate (inclusive)
    return now >= start && now <= end;
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

    // Validate date duration (1-90 days)
    const durationValidation = this.validateDateDuration(
      new Date(startDate),
      new Date(endDate),
    );
    if (!durationValidation.isValid) {
      throw new BadRequestException(durationValidation.error);
    }

    // Validate start date is not in the past
    if (!this.isStartDateValid(new Date(startDate))) {
      throw new BadRequestException(
        'Start date must be today or a future date.',
      );
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

    await savedAdvert.populate([
      {
        path: 'owner',
        select: 'firstName lastName email phoneNumber photoUrl',
      },
      { path: 'category', select: 'name description' },
    ]);

    // Send submission confirmation email
    try {
      const owner = savedAdvert.owner as any;
      await this.emailService.sendAdvertSubmittedEmail({
        email: owner.email,
        customerName: `${owner.firstName} ${owner.lastName}`,
        advertTitle: savedAdvert.title,
        advertType: savedAdvert.type,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send advert submission email: ${error.message}`,
      );
      // Don't throw - email failure shouldn't block advert creation
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

    // Enforce rejection reason when rejecting
    if (dto.status === AdvertStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting an advert',
      );
    }

    advert.status = dto.status;
    if (dto.status === AdvertStatus.REJECTED) {
      advert.rejectionReason = dto.rejectionReason;
    } else if (dto.status === AdvertStatus.APPROVED) {
      // Clear rejection reason when approving
      advert.rejectionReason = undefined;
    }
    advert.reviewedBy = new Types.ObjectId(adminId);

    const savedAdvert = await advert.save();

    // Populate owner to get email details
    await savedAdvert.populate({
      path: 'owner',
      select: 'firstName lastName email',
    });

    // Send review notification email
    try {
      const owner = savedAdvert.owner as any;
      await this.emailService.sendAdvertReviewedEmail({
        email: owner.email,
        customerName: `${owner.firstName} ${owner.lastName}`,
        advertTitle: savedAdvert.title,
        status: dto.status === AdvertStatus.APPROVED ? 'approved' : 'rejected',
        rejectionReason: dto.rejectionReason,
      });
    } catch (error) {
      this.logger.error(`Failed to send advert review email: ${error.message}`);
      // Don't throw - email failure shouldn't block review process
    }

    return savedAdvert;
  }

  /** Hub / admin listing with pagination & filters */
  async findAll(query: AdvertQueryDto, isAdminQuery = false) {
    const filter: any = {};

    if (query.type) filter.type = query.type;
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.owner) filter.owner = new Types.ObjectId(query.owner);

    // For public queries (non-admin), only return APPROVED adverts
    if (isAdminQuery) {
      if (query.status) filter.status = query.status;
    } else {
      // Public users only see APPROVED adverts
      filter.status = AdvertStatus.APPROVED;
    }

    // Optimize populate - only fetch essential fields for list view
    const populate = [
      {
        path: 'owner',
        select: 'firstName lastName email', // Removed phoneNumber and photoUrl for list view
      },
      { 
        path: 'category', 
        select: 'name' // Only name needed for list view
      },
    ];

    // Only populate reviewedBy for admin queries where it might be needed
    if (isAdminQuery) {
      populate.push({ 
        path: 'reviewedBy', 
        select: 'firstName lastName' 
      });
    }

    return this.paginationService.paginate(this.advertModel, {
      page: query.page,
      limit: query.limit,
      filter,
      sort: { createdAt: -1 },
      populate,
    });
  }

  /** Find one advert with full details */
  async findOne(id: string): Promise<Advert> {
    const advert = await this.advertModel
      .findById(id)
      .populate('owner', 'firstName lastName email phoneNumber photoUrl')
      .populate('category', 'name description')
      .populate('reviewedBy', 'firstName lastName')
      .lean()
      .exec();

    if (!advert) throw new NotFoundException('Advert not found');

    if (advert.status !== AdvertStatus.APPROVED) {
      throw new NotFoundException('Advert not found');
    }

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

    // Check if advert status allows updates
    if (!this.UPDATABLE_STATUSES.includes(advert.status)) {
      if (advert.status === AdvertStatus.APPROVED) {
        throw new BadRequestException(
          'Cannot update an approved advert. Please contact support if changes are needed.',
        );
      }
      if (advert.status === AdvertStatus.EXPIRED) {
        throw new BadRequestException('Cannot update an expired advert.');
      }
      // Fallback for any other non-updatable status
      throw new BadRequestException(
        `Cannot update an advert with status ${advert.status}.`,
      );
    }

    // Handle rejected advert resubmission
    if (advert.status === AdvertStatus.REJECTED) {
      advert.status = AdvertStatus.PENDING;
      advert.rejectionReason = undefined;
      advert.reviewedBy = undefined;
    }

    // Validate dates if being updated
    const newStartDate = dto.startDate
      ? new Date(dto.startDate)
      : advert.startDate;
    const newEndDate = dto.endDate ? new Date(dto.endDate) : advert.endDate;

    // Validate start date is not in the past if being updated
    if (dto.startDate && !this.isStartDateValid(newStartDate)) {
      throw new BadRequestException(
        'Start date must be today or a future date.',
      );
    }

    // Validate duration if either date is being updated
    if (dto.startDate || dto.endDate) {
      const durationValidation = this.validateDateDuration(
        newStartDate,
        newEndDate,
      );
      if (!durationValidation.isValid) {
        throw new BadRequestException(durationValidation.error);
      }
    }

    if (dto.category) {
      await this.validateAdvertCategory(dto.category);
      (dto as any).category = new Types.ObjectId(dto.category);
    }

    Object.assign(advert, dto);
    const savedAdvert = await advert.save();

    return savedAdvert;
  }

  /** Delete advert (customer deletes their own advert) */
  async remove(id: string, ownerId: string): Promise<{ deleted: boolean }> {
    // Fetch the advert first to check status and active state
    const advert = await this.advertModel.findOne({
      _id: id,
      owner: new Types.ObjectId(ownerId),
    });

    if (!advert) {
      throw new NotFoundException('Advert not found or not owned by you');
    }

    // Allow deletion of adverts in any status
    const res = await this.advertModel.deleteOne({ _id: id }).exec();

    return { deleted: res.deletedCount > 0 };
  }

  /** Delete advert (admin can delete any advert) */
  async adminRemove(id: string): Promise<{ deleted: boolean }> {
    const advert = await this.advertModel.findById(id);

    if (!advert) {
      throw new NotFoundException('Advert not found');
    }

    const res = await this.advertModel.deleteOne({ _id: id }).exec();

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

    return res.modifiedCount;
  }
}
