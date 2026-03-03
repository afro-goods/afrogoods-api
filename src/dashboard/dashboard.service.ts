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
      const matchStage: any = { status: { $in: this.PAID_ORDER_STATUSES } };

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

      // Aggregate from both Order and GuestOrder collections
      const orderSales = await this.orderModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $month: '$createdAt' },
            totalSales: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const guestOrderSales = await this.guestOrderModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $month: '$createdAt' },
            totalSales: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Combine sales from both collections
      const salesByMonth = new Map<number, number>();

      orderSales.forEach((item) => {
        salesByMonth.set(
          item._id,
          (salesByMonth.get(item._id) || 0) + item.totalSales,
        );
      });

      guestOrderSales.forEach((item) => {
        salesByMonth.set(
          item._id,
          (salesByMonth.get(item._id) || 0) + item.totalSales,
        );
      });

      // Convert to response format
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      const result: SalesAnalyticsDto[] = [];
      salesByMonth.forEach((totalSales, monthNumber) => {
        result.push({
          month: monthNames[monthNumber - 1],
          onlineSales: totalSales,
          shopSales: 0, // Placeholder for future multi-channel support
        });
      });

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
