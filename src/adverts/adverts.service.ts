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
import { CaptchaService } from '../shared/services/captcha/captcha.service';
import { PaymentSettingsService } from '../payment-settings/payment-settings.service';
import { config } from 'src/config';

@Injectable()
export class AdvertsService {
  private readonly logger = new Logger(AdvertsService.name);

  /** Maximum number of active (pending/approved) adverts per user */
  private readonly MAX_ACTIVE_ADVERTS = 2;

  /** Default advert duration in days (fallback) */
  private readonly DEFAULT_ADVERT_DURATION_DAYS = 30;

  /** Statuses that allow user updates */
  private readonly UPDATABLE_STATUSES = [
    AdvertStatus.PENDING,
    AdvertStatus.REJECTED,
  ];

  constructor(
    @InjectModel(Advert.name) private advertModel: Model<AdvertDocument>,
    private readonly paginationService: PaginationService,
    private readonly categoriesService: CategoriesService,
    private readonly emailService: EmailService,
    private readonly captchaService: CaptchaService,
    private readonly paymentSettingsService: PaymentSettingsService,
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
    remoteIp?: string,
  ): Promise<Advert> {
    const { category, captchaToken } = createAdvertDto;

    // Verify CAPTCHA
    const isCaptchaValid = await this.captchaService.verify(
      captchaToken,
      remoteIp,
    );
    if (!isCaptchaValid) {
      throw new BadRequestException(
        'CAPTCHA verification failed. Please try again.',
      );
    }

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

    // Validate that the category exists and is of type 'advert'
    await this.validateAdvertCategory(category);

    const {
      startDate: _startDate,
      endDate: _endDate,
      captchaToken: _captchaToken,
      category: _category,
      ...advertData
    } = createAdvertDto as any;

    const advert = new this.advertModel({
      ...advertData,
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
    } catch {
      this.logger.error(`Failed to send advert submission email`);
      // Don't throw - email failure shouldn't block advert creation
    }

    // Notify admins (optional) that a new advert is pending review
    const adminEmails = config.admin?.advertReviewEmails ?? [];
    if (adminEmails.length > 0) {
      const owner = savedAdvert.owner as any;
      await Promise.allSettled(
        adminEmails.map((adminEmail) =>
          this.emailService.sendAdminAdvertSubmittedEmail({
            adminEmail,
            customerName: `${owner.firstName} ${owner.lastName}`,
            customerEmail: owner.email,
            advertId: savedAdvert._id.toString(),
            advertTitle: savedAdvert.title,
            advertType: savedAdvert.type,
          }),
        ),
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

    // Enforce rejection reason when rejecting
    if (dto.status === AdvertStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting an advert',
      );
    }

    // Check if approving after start date or end date has passed
    if (dto.status === AdvertStatus.APPROVED) {
      const now = new Date();

      // For new adverts (without startDate/endDate), we calculate them now
      if (!advert.startDate || !advert.endDate) {
        let durationDays = this.DEFAULT_ADVERT_DURATION_DAYS;
        try {
          const settings = await this.paymentSettingsService.getSettings();
          durationDays = settings.advertDurationDays || durationDays;
        } catch {
          this.logger.warn(
            `Failed to fetch payment settings, using default duration: ${durationDays} days`,
          );
        }

        advert.startDate = now;
        advert.endDate = new Date(
          now.getTime() + durationDays * 24 * 60 * 60 * 1000,
        );
        advert.approvedAt = now;
      } else {
        // Legacy advert handling
        const endDate = new Date(advert.endDate);
        if (now > endDate) {
          throw new BadRequestException(
            `Cannot approve this advert. The campaign end date (${endDate.toLocaleDateString()}) has already passed.`,
          );
        }
        advert.approvedAt = now;
      }
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
    } catch {
      this.logger.error(`Failed to send advert review email`);
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
    if (query.location)
      filter.location = { $regex: query.location, $options: 'i' };

    // For public queries (non-admin), only return APPROVED adverts
    if (isAdminQuery) {
      if (query.status) filter.status = query.status;
    } else {
      filter.status = AdvertStatus.APPROVED;
    }

    // If search is provided, use aggregation to filter by owner name/email
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      const pipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerData',
          },
        },
        { $unwind: { path: '$ownerData', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { 'ownerData.email': { $regex: search, $options: 'i' } },
              { 'ownerData.firstName': { $regex: search, $options: 'i' } },
              { 'ownerData.lastName': { $regex: search, $options: 'i' } },
              { title: { $regex: search, $options: 'i' } },
            ],
          },
        },
      ];

      const [countResult, data] = await Promise.all([
        this.advertModel.aggregate([...pipeline, { $count: 'total' }]),
        this.advertModel.aggregate([
          ...pipeline,
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          // Re-populate category and reviewedBy via lookup
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'users',
              localField: 'reviewedBy',
              foreignField: '_id',
              as: 'reviewedBy',
            },
          },
          { $unwind: { path: '$reviewedBy', preserveNullAndEmptyArrays: true } },
          // Map ownerData back to owner field
          { $addFields: { owner: '$ownerData' } },
          { $project: { ownerData: 0 } },
        ]),
      ]);

      const total = countResult[0]?.total || 0;
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

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
