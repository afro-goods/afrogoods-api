import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/orders.schema';
import {
  GuestOrder,
  GuestOrderDocument,
} from '../orders/schemas/guest-order.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { Advert } from '../adverts/schemas/advert.schema';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { DashboardMetricsQueryDto } from './dto/dashboard-metrics-query.dto';
import { SalesAnalyticsDto } from './dto/sales-analytics.dto';
import { SalesAnalyticsQueryDto } from './dto/sales-analytics-query.dto';
import { RecentOrderDto } from './dto/recent-order.dto';
import { RecentOrdersQueryDto } from './dto/recent-orders-query.dto';
import { TopProductDto } from './dto/top-product.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { MonthlyProfitsDto } from './dto/monthly-profits.dto';
import { MonthlyProfitsQueryDto } from './dto/monthly-profits-query.dto';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { AvailabilityStatus } from '../product/enums/availabilty-status.enum';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private readonly PAID_ORDER_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.PAID,
    OrderStatus.SHIPPED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
  ];

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(GuestOrder.name)
    private guestOrderModel: Model<GuestOrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Advert.name) private advertModel: Model<Advert>,
  ) {}

  async getMetrics(
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardMetricsDto> {
    try {
      const matchStage: any = {};

      // Apply date range filter if provided
      if (query.startDate || query.endDate) {
        matchStage.createdAt = {};
        if (query.startDate) {
          matchStage.createdAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          matchStage.createdAt.$lte = new Date(query.endDate);
        }
      }

      // Aggregate regular orders
      const orderMetrics = await this.orderModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $facet: {
            totalOrders: [{ $count: 'count' }],
            paidOrders: [
              { $match: { status: { $in: this.PAID_ORDER_STATUSES } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: '$totalAmount' },
                },
              },
            ],
          },
        },
      ]);

      // Aggregate guest orders
      const guestOrderMetrics = await this.guestOrderModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $facet: {
            totalOrders: [{ $count: 'count' }],
            paidOrders: [
              { $match: { status: { $in: this.PAID_ORDER_STATUSES } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: '$totalAmount' },
                },
              },
            ],
          },
        },
      ]);

      // Count total products
      const totalProducts = await this.productModel.countDocuments();

      // Count total adverts
      const totalAdverts = await this.advertModel.countDocuments();

      // Extract and combine metrics
      const orderTotal = orderMetrics[0]?.totalOrders[0]?.count || 0;
      const guestOrderTotal = guestOrderMetrics[0]?.totalOrders[0]?.count || 0;

      const orderRevenue = orderMetrics[0]?.paidOrders[0]?.revenue || 0;
      const guestOrderRevenue =
        guestOrderMetrics[0]?.paidOrders[0]?.revenue || 0;

      return {
        totalSales: orderRevenue + guestOrderRevenue,
        totalOrders: orderTotal + guestOrderTotal,
        totalProducts,
        totalAdverts,
      };
    } catch (error) {
      this.logger.error('Failed to fetch dashboard metrics', error.stack);
      throw new InternalServerErrorException(
        'Failed to fetch dashboard metrics',
      );
    }
  }

  async getSalesAnalytics(
    query: SalesAnalyticsQueryDto,
  ): Promise<SalesAnalyticsDto[]> {
    try {
      const groupBy = query.groupBy || 'month';

      // Calculate date ranges for current and previous periods
      let currentStart: Date;
      let currentEnd: Date;
      let previousStart: Date;
      let previousEnd: Date;

      if (query.startDate && query.endDate) {
        currentStart = new Date(query.startDate);
        currentEnd = new Date(query.endDate);
        const durationMs = currentEnd.getTime() - currentStart.getTime();
        previousEnd = new Date(currentStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - durationMs);
      } else if (groupBy === 'day') {
        // Default for daily: last 7 days vs previous 7 days
        currentEnd = new Date();
        currentStart = new Date(currentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        // Default for monthly: last 30 days vs previous 30 days
        currentEnd = new Date();
        currentStart = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const getSales = async (startDate: Date, endDate: Date) => {
        const matchStage = {
          status: { $in: this.PAID_ORDER_STATUSES },
          createdAt: { $gte: startDate, $lte: endDate },
        };

        const groupId =
          groupBy === 'day'
            ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }
            : { month: { $month: '$createdAt' } };

        const [orderSales, guestOrderSales] = await Promise.all([
          this.orderModel.aggregate([
            { $match: matchStage },
            { $group: { _id: groupId, totalSales: { $sum: '$totalAmount' } } },
          ]),
          this.guestOrderModel.aggregate([
            { $match: matchStage },
            { $group: { _id: groupId, totalSales: { $sum: '$totalAmount' } } },
          ]),
        ]);

        const salesMap = new Map<string, number>();
        const toKey = (id: any) =>
          groupBy === 'day'
            ? `${id.year}-${String(id.month).padStart(2, '0')}-${String(id.day).padStart(2, '0')}`
            : String(id.month);

        [...orderSales, ...guestOrderSales].forEach((item) => {
          const key = toKey(item._id);
          salesMap.set(key, (salesMap.get(key) || 0) + item.totalSales);
        });

        return salesMap;
      };

      const [currentSales, previousSales] = await Promise.all([
        getSales(currentStart, currentEnd),
        getSales(previousStart, previousEnd),
      ]);

      const result: SalesAnalyticsDto[] = [];

      if (groupBy === 'day') {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // Generate all days in the current period
        const days: string[] = [];
        const cursor = new Date(currentStart);
        while (cursor <= currentEnd) {
          const key = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
          days.push(key);
          cursor.setDate(cursor.getDate() + 1);
        }

        days.forEach((dateKey) => {
          const date = new Date(dateKey);
          const dayNum = date.getUTCDate();
          const dayName = dayNames[date.getUTCDay()];
          const label = `${dayNum} ${dayName}`;
          // Map previous period: same offset from its start
          const offsetMs = new Date(dateKey).getTime() - currentStart.getTime();
          const prevDate = new Date(previousStart.getTime() + offsetMs);
          const prevKey = prevDate.toISOString().slice(0, 10);

          result.push({
            month: label,
            currentPeriod: currentSales.get(dateKey) || 0,
            previousPeriod: previousSales.get(prevKey) || 0,
          });
        });
      } else {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const allMonths = new Set([...currentSales.keys(), ...previousSales.keys()]);
        allMonths.forEach((key) => {
          result.push({
            month: monthNames[parseInt(key) - 1],
            currentPeriod: currentSales.get(key) || 0,
            previousPeriod: previousSales.get(key) || 0,
          });
        });
        result.sort((a, b) => monthNames.indexOf(a.month) - monthNames.indexOf(b.month));
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch sales analytics', error.stack);
      throw new InternalServerErrorException('Failed to fetch sales analytics');
    }
  }

  async getRecentOrders(
    query: RecentOrdersQueryDto,
  ): Promise<RecentOrderDto[]> {
    try {
      const limit = query.limit || 10;
      const matchStage: any = {};

      // Apply date range filter if provided
      if (query.startDate || query.endDate) {
        matchStage.createdAt = {};
        if (query.startDate) {
          matchStage.createdAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          matchStage.createdAt.$lte = new Date(query.endDate);
        }
      }

      // Get recent orders from both collections
      const orders = await this.orderModel
        .find(matchStage)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('items.productId')
        .populate({
          path: 'items.productId',
          populate: { path: 'category' },
        })
        .lean();

      const guestOrders = await this.guestOrderModel
        .find(matchStage)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('items.productId')
        .populate({
          path: 'items.productId',
          populate: { path: 'category' },
        })
        .lean();

      // Combine and sort all orders
      const allOrders = [...orders, ...guestOrders]
        .sort((a: any, b: any) => {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        })
        .slice(0, limit);

      // Map to response format
      const result: RecentOrderDto[] = allOrders.map((order: any) => {
        const firstItem = order.items[0];
        const product = firstItem?.productId;
        const category = product?.category;

        return {
          id: order.orderId,
          productName: product?.name || 'Unknown Product',
          category: category?.name || 'Unknown Category',
          price: order.totalAmount,
          quantity: order.items.reduce(
            (sum: number, item: any) => sum + item.quantity,
            0,
          ),
          imageUrl: product?.images?.[0] || '',
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch recent orders', error.stack);
      throw new InternalServerErrorException('Failed to fetch recent orders');
    }
  }

  async getTopProducts(query: TopProductsQueryDto): Promise<TopProductDto[]> {
    try {
      const limit = query.limit || 10;
      const matchStage: any = {};

      // Apply date range filter if provided
      if (query.startDate || query.endDate) {
        matchStage.createdAt = {};
        if (query.startDate) {
          matchStage.createdAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          matchStage.createdAt.$lte = new Date(query.endDate);
        }
      }

      // Aggregate sales from both Order and GuestOrder collections
      const orderProducts = await this.orderModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            salesCount: { $sum: '$items.quantity' },
            earnings: {
              $sum: {
                $multiply: ['$items.quantity', '$items.priceAtPurchase'],
              },
            },
          },
        },
      ]);

      const guestOrderProducts = await this.guestOrderModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            salesCount: { $sum: '$items.quantity' },
            earnings: {
              $sum: {
                $multiply: ['$items.quantity', '$items.priceAtPurchase'],
              },
            },
          },
        },
      ]);

      // Combine sales from both collections
      const productSales = new Map<
        string,
        { salesCount: number; earnings: number }
      >();

      orderProducts.forEach((item) => {
        const productId = item._id.toString();
        productSales.set(productId, {
          salesCount: item.salesCount,
          earnings: item.earnings,
        });
      });

      guestOrderProducts.forEach((item) => {
        const productId = item._id.toString();
        const existing = productSales.get(productId);
        if (existing) {
          productSales.set(productId, {
            salesCount: existing.salesCount + item.salesCount,
            earnings: existing.earnings + item.earnings,
          });
        } else {
          productSales.set(productId, {
            salesCount: item.salesCount,
            earnings: item.earnings,
          });
        }
      });

      // Sort by sales count and get top products
      const sortedProducts = Array.from(productSales.entries())
        .sort((a, b) => b[1].salesCount - a[1].salesCount)
        .slice(0, limit);

      // Fetch product details
      const productIds = sortedProducts.map(([id]) => id);
      const products = await this.productModel
        .find({ _id: { $in: productIds } })
        .lean();

      // Map to response format
      const result: TopProductDto[] = sortedProducts
        .map(([productId, sales]) => {
          const product = products.find((p) => p._id.toString() === productId);
          if (!product) return null;

          return {
            id: product._id.toString(),
            productName: product.name,
            imageUrl: product.images?.[0] || '',
            status:
              product.availabilityStatus === AvailabilityStatus.IN_STOCK
                ? 'Live'
                : 'Draft',
            salesCount: sales.salesCount,
            earnings: sales.earnings,
          };
        })
        .filter((item): item is TopProductDto => item !== null);

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch top products', error.stack);
      throw new InternalServerErrorException('Failed to fetch top products');
    }
  }

  async getMonthlyProfits(
    query: MonthlyProfitsQueryDto,
  ): Promise<MonthlyProfitsDto> {
    try {
      let startDate: Date;
      let endDate: Date;

      // Use startDate/endDate if provided, otherwise use month/year
      if (query.startDate || query.endDate) {
        startDate = query.startDate ? new Date(query.startDate) : new Date(0);
        endDate = query.endDate ? new Date(query.endDate) : new Date();
      } else {
        const now = new Date();
        const month = query.month || now.getMonth() + 1;
        const year = query.year || now.getFullYear();

        // Create date range for the specified month
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
      }

      const matchStage = {
        status: { $in: this.PAID_ORDER_STATUSES },
        createdAt: { $gte: startDate, $lte: endDate },
      };

      // Aggregate from both Order and GuestOrder collections
      const orderProfits = await this.orderModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: '$totalAmount' },
          },
        },
      ]);

      const guestOrderProfits = await this.guestOrderModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: '$totalAmount' },
          },
        },
      ]);

      const orderProfit = orderProfits[0]?.totalProfit || 0;
      const guestOrderProfit = guestOrderProfits[0]?.totalProfit || 0;
      const totalProfit = orderProfit + guestOrderProfit;

      return {
        onlineProfit: totalProfit,
        shopProfit: 0, // Placeholder for future multi-channel support
        totalProfit,
      };
    } catch (error) {
      this.logger.error('Failed to fetch monthly profits', error.stack);
      throw new InternalServerErrorException('Failed to fetch monthly profits');
    }
  }
}
