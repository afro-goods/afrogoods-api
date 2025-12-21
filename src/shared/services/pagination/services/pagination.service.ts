import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import {
  PaginationOptions,
  PaginationResult,
} from '../interfaces/pagination.interface';

@Injectable()
export class PaginationService {
  async paginate<T>(
    model: Model<T>,
    options: PaginationOptions<T> = {},
  ): Promise<PaginationResult<T>> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: QueryFilter<T> = options.filter || {};

    const [data, total] = await Promise.all([
      model
        .find(filter, options.projection)
        .sort(options.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(options.populate || [])
        .lean()
        .exec(),
      model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getPercentageGrowth<T>(
    model: Model<T>,
    baseFilter: QueryFilter<T> = {},
    dateField: string = 'createdAt',
  ): Promise<number> {
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const prevMonth = new Date(lastMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);

    const [current, previous] = await Promise.all([
      model.countDocuments({
        ...baseFilter,
        [dateField]: { $gte: lastMonth, $lt: now },
      }),
      model.countDocuments({
        ...baseFilter,
        [dateField]: { $gte: prevMonth, $lt: lastMonth },
      }),
    ]);

    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    return Number((((current - previous) / previous) * 100).toFixed(2));
  }
}
