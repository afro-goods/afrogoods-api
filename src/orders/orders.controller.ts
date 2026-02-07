import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from './enums/order-status.enum';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import { AdminOrderSearchDto } from './dto/admin-order-search.dto';
import { UpdateShippingAddressDto } from './dto/update-shipping-address.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  // ============================================================
  // CUSTOMER ENDPOINTS (7)
  // ============================================================

  /** POST /orders - Create order from cart */
  @Post()
  @UseGuards(FirebaseAuthGuard)
  createOrder(@CurrentUser('_id') userId: string) {
    return this.ordersService.createOrder(userId);
  }

  /** GET /orders/my - List user's orders (paginated) */
  @Get('my')
  @UseGuards(FirebaseAuthGuard)
  getMyOrders(
    @CurrentUser('_id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getMyOrders(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** GET /orders/:id - Get order details */
  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  getOrderById(@Param('id') id: string, @CurrentUser('_id') userId: string) {
    return this.ordersService.getOrderById(id, userId);
  }

  /** PATCH /orders/:id/cancel - Cancel order */
  @Patch(':id/cancel')
  @UseGuards(FirebaseAuthGuard)
  cancelOrder(
    @Param('id') id: string,
    @CurrentUser('_id') userId: string,
    @Body() cancelDto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(id, userId, cancelDto.reason);
  }

  /** PATCH /orders/:id/shipping-address - Update shipping address */
  @Patch(':id/shipping-address')
  @UseGuards(FirebaseAuthGuard)
  updateShippingAddress(
    @Param('id') orderId: string,
    @CurrentUser('_id') userId: string,
    @Body() updateDto: UpdateShippingAddressDto,
  ) {
    return this.ordersService.updateShippingAddress(orderId, userId, updateDto);
  }

  /** POST /orders/:id/notes - Add note to order */
  @Post(':id/notes')
  @UseGuards(FirebaseAuthGuard)
  addNote(
    @Param('id') orderId: string,
    @CurrentUser('_id') userId: string,
    @Body() noteDto: { content: string },
  ) {
    return this.ordersService.addCustomerNote(orderId, userId, noteDto.content);
  }

  /** POST /orders/:id/mock-pay - Mock payment for testing */
  @Post(':id/mock-pay')
  @UseGuards(FirebaseAuthGuard)
  mockPay(@Param('id') id: string, @CurrentUser('_id') userId: string) {
    return this.ordersService.mockPay(id, userId);
  }

  // ============================================================
  // GUEST ENDPOINTS (5)
  // ============================================================

  /** POST /orders/guest - Create guest order */
  @Post('guest')
  createGuestOrder(@Body() guestCheckoutDto: GuestCheckoutDto) {
    return this.ordersService.createGuestOrder(guestCheckoutDto);
  }

  /** GET /orders/guest/track - Track guest order by orderId + email */
  @Get('guest/track')
  trackGuestOrder(
    @Query('orderId') orderId: string,
    @Query('email') email: string,
  ) {
    return this.ordersService.trackGuestOrder(orderId, email);
  }

  /** PATCH /orders/guest/:id/cancel - Cancel guest order */
  @Patch('guest/:id/cancel')
  cancelGuestOrder(
    @Param('id') orderId: string,
    @Body() cancelDto: { email: string; reason?: string },
  ) {
    return this.ordersService.cancelGuestOrder(
      orderId,
      cancelDto.email,
      cancelDto.reason,
    );
  }

  /** PATCH /orders/guest/:id/shipping-address - Update guest shipping address */
  @Patch('guest/:id/shipping-address')
  updateGuestShippingAddress(
    @Param('id') orderId: string,
    @Body() body: { email: string } & UpdateShippingAddressDto,
  ) {
    return this.ordersService.updateGuestShippingAddress(
      orderId,
      body.email,
      body,
    );
  }

  /** POST /orders/guest/:id/notes - Add note to guest order */
  @Post('guest/:id/notes')
  addGuestNote(
    @Param('id') orderId: string,
    @Body() noteDto: { email: string; content: string },
  ) {
    return this.ordersService.addGuestNote(
      orderId,
      noteDto.email,
      noteDto.content,
    );
  }

  // ============================================================
  // ADMIN ENDPOINTS (5) - Requires Admin Role
  // ============================================================

  /** GET /orders/admin/all - List all orders including guest orders (paginated) */
  @Get('admin/all')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAllOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.ordersService.getAllOrdersIncludingGuest(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** GET /orders/admin/search - Search orders with filters */
  @Get('admin/search')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  searchOrders(@Query() searchDto: AdminOrderSearchDto) {
    return this.ordersService.searchOrders(searchDto);
  }

  /** GET /orders/admin/order/:id - Get order details */
  @Get('admin/order/:id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOrderDetails(@Param('id') orderId: string) {
    const orderDetails =
      await this.ordersService.getOrderDetailsForAdmin(orderId);
    if (!orderDetails) {
      throw new NotFoundException('Order not found');
    }
    return orderDetails;
  }

  /** PATCH /orders/admin/order/:id/status - Update order status (sends email to customer, handles both regular and guest orders) */
  @Patch('admin/order/:id/status')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; adminMessage?: string; trackingNumber?: string },
  ) {
    return this.ordersService.updateOrderOrGuestStatusWithNotification(
      id,
      body.status,
      body.adminMessage,
      body.trackingNumber,
    );
  }

  /** POST /orders/admin/order/:id/notes - Add admin note */
  @Post('admin/order/:id/notes')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  addAdminNote(
    @Param('id') orderId: string,
    @CurrentUser('_id') adminId: string,
    @Body() noteDto: { content: string; visibleToCustomer?: boolean },
  ) {
    return this.ordersService.addAdminNote(
      orderId,
      adminId,
      noteDto.content,
      noteDto.visibleToCustomer ?? false,
    );
  }
}
