import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enum/user.enum';
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

@Controller('dashboard')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(
    @Query() query: DashboardMetricsQueryDto,
  ): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(query);
  }

  @Get('sales-analytics')
  getSalesAnalytics(
    @Query() query: SalesAnalyticsQueryDto,
  ): Promise<SalesAnalyticsDto[]> {
    return this.dashboardService.getSalesAnalytics(query);
  }

  @Get('recent-orders')
  getRecentOrders(
    @Query() query: RecentOrdersQueryDto,
  ): Promise<RecentOrderDto[]> {
    return this.dashboardService.getRecentOrders(query);
  }

  @Get('top-products')
  getTopProducts(
    @Query() query: TopProductsQueryDto,
  ): Promise<TopProductDto[]> {
    return this.dashboardService.getTopProducts(query);
  }

  @Get('monthly-profits')
  getMonthlyProfits(
    @Query() query: MonthlyProfitsQueryDto,
  ): Promise<MonthlyProfitsDto> {
    return this.dashboardService.getMonthlyProfits(query);
  }
}
