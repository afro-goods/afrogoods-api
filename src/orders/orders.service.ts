import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';

import { Order, OrderDocument } from './schemas/orders.schema';
import { GuestOrder, GuestOrderDocument } from './schemas/guest-order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';

import { OrderStatus } from './enums/order-status.enum';
import { generateOrderId } from '../utilities/generateId/orderId';
import { inTransaction } from '../utilities/transaction';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import {
  AdminOrderSearchDto,
  AdminOrderResponseDto,
  AdminOrderListResponseDto,
} from './dto/admin-order-search.dto';
import { OrdersEmailService } from './services/orders-email.service';
import { UpdateShippingAddressDto } from './dto/update-shipping-address.dto';
import { PaginationService } from '../shared/services/pagination/services/pagination.service';
import type { PaginationResult } from '../shared/services/pagination/interfaces/pagination.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(GuestOrder.name)
    private readonly guestOrderModel: Model<GuestOrderDocument>,
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly ordersEmailService: OrdersEmailService,
    private readonly paginationService: PaginationService,
    private readonly usersService: UsersService,
  ) {}

  // ============================================================
  // BUSINESS RULES CONFIGURATION
  // ============================================================

  private readonly MODIFIABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
  ];

  private readonly CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
  ];

  private readonly STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ],
    [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.REFUNDED]: [],
  };

  private readonly DEFAULT_STATUS_REASONS: Record<OrderStatus, string> = {
    [OrderStatus.PENDING]: 'Order placed',
    [OrderStatus.CONFIRMED]: 'Order confirmed by admin',
    [OrderStatus.PAID]: 'Payment received',
    [OrderStatus.PROCESSING]: 'Order is being processed',
    [OrderStatus.SHIPPED]: 'Order has been shipped',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Order is out for delivery',
    [OrderStatus.DELIVERED]: 'Order delivered successfully',
    [OrderStatus.CANCELLED]: 'Order cancelled',
    [OrderStatus.REFUNDED]: 'Order refunded',
  };

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  private canModify(status: OrderStatus): boolean {
    return this.MODIFIABLE_STATUSES.includes(status);
  }

  private canCancel(status: OrderStatus): boolean {
    return this.CANCELLABLE_STATUSES.includes(status);
  }

  private isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    return this.STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private async validateAndGetCartItems(
    cart: CartDocument,
    session?: ClientSession,
  ) {
    const productIds = cart.items
      .map((item) =>
        Types.ObjectId.isValid(item.productId as any)
          ? new Types.ObjectId(item.productId)
          : null,
      )
      .filter(Boolean) as Types.ObjectId[];

    if (!productIds.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    const products = await this.productModel
      .find({ _id: { $in: productIds }, availabilityStatus: 'In Stock' })
      .select('_id stock')
      .session(session || null)
      .lean();

    if (!products.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    const productStockMap = new Map(
      products.map((p) => [p._id.toString(), p.stock]),
    );
    const validItems: typeof cart.items = [];
    const outOfStockItems: Array<{
      productId: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of cart.items) {
      const productId = item.productId.toString();
      const availableStock = productStockMap.get(productId);

      if (availableStock === undefined) continue;
      if (availableStock < item.quantity) {
        outOfStockItems.push({
          productId,
          requested: item.quantity,
          available: availableStock,
        });
        continue;
      }
      validItems.push(item);
    }

    if (outOfStockItems.length > 0) {
      throw new BadRequestException(
        `Insufficient stock: ${outOfStockItems.map((i) => `${i.productId} (need ${i.requested}, have ${i.available})`).join(', ')}`,
      );
    }

    if (!validItems.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    return validItems;
  }

  private async reduceStock(
    items: Array<{ productId: any; quantity: number }>,
    session?: ClientSession,
  ) {
    for (const item of items) {
      await this.productModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } },
        { session },
      );
    }
  }

  private async restoreStock(
    items: Array<{ productId: any; quantity: number }>,
    session?: ClientSession,
  ) {
    for (const item of items) {
      await this.productModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity } },
        { session },
      );
    }
  }

  // ============================================================
  // CUSTOMER OPERATIONS
  // ============================================================

  /** Create order from cart for registered user (with transaction) */
  async createOrder(userId: string): Promise<OrderDocument> {
    const order = await inTransaction(this.connection, async (session) => {
      const cart = await this.cartModel.findOne({ userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const validItems = await this.validateAndGetCartItems(cart, session);
      await this.reduceStock(validItems, session);

      const [createdOrder] = await this.orderModel.create(
        [
          {
            orderId: generateOrderId(),
            userId: new Types.ObjectId(userId),
            items: validItems.map((item) => ({
              productId: new Types.ObjectId(item.productId),
              quantity: item.quantity,
              priceAtPurchase: item.priceAtAddedTime,
            })),
            totalAmount: cart.totalAmount,
            status: OrderStatus.PENDING,
            isPaid: false,
            notes: [],
            statusHistory: [
              {
                status: OrderStatus.PENDING,
                reason: 'Order created',
                updatedBy: 'system',
                createdAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );

      cart.items = [];
      cart.totalAmount = 0;
      await cart.save({ session });

      return createdOrder;
    });

    try {
      const user = await this.usersService.findById(userId);
      await this.ordersEmailService.sendOrderConfirmationEmail(
        user.email,
        order.orderId,
        {
          totalAmount: order.totalAmount,
          itemCount: order.items.length,
          customerName: `${user.firstName} ${user.lastName}`,
        },
      );
    } catch {
      // Don't fail order creation if email fails
    }
    return order;
  }

  /** Get all orders for a registered user (paginated) */
  async getMyOrders(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginationResult<Order>> {
    return this.paginationService.paginate(this.orderModel, {
      page,
      limit,
      filter: { userId },
      sort: { createdAt: -1 },
      populate: [{ path: 'items.productId', select: 'name price images' }],
    });
  }

  /** Get single order for a registered user */
  async getOrderById(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({ orderId, userId })
      .populate('items.productId', 'name price images');
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Cancel order for registered user (with transaction) */
  async cancelOrder(
    orderId: string,
    userId: string,
    reason?: string,
  ): Promise<OrderDocument> {
    const order = await inTransaction(this.connection, async (session) => {
      const orderDoc = await this.orderModel
        .findOne({ orderId, userId })
        .session(session);
      if (!orderDoc) throw new NotFoundException('Order not found');
      if (!this.canCancel(orderDoc.status)) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${orderDoc.status}`,
        );
      }

      const previousStatus = orderDoc.status;
      orderDoc.status = OrderStatus.CANCELLED;
      orderDoc.cancelledAt = new Date();
      orderDoc.cancellationReason = reason;
      orderDoc.statusHistory.push({
        status: OrderStatus.CANCELLED,
        previousStatus,
        reason: reason || 'Order cancelled by customer',
        updatedBy: userId,
        createdAt: new Date(),
      });
      orderDoc.notes.push({
        content: `Order cancelled${reason ? `: ${reason}` : ''}`,
        source: 'system',
        authorId: userId,
        visibleToCustomer: true,
        createdAt: new Date(),
      });

      await this.restoreStock(orderDoc.items, session);
      return orderDoc.save({ session });
    });

    try {
      const user = await this.usersService.findById(userId);
      await this.ordersEmailService.sendCancellationConfirmationEmail(
        user.email,
        orderId,
        {
          customerName: `${user.firstName} ${user.lastName}`,
          refundAmount: 0,
          refundTimeline: 'Not applicable',
          cancellationReason: reason || 'Order cancelled by customer',
          orderTotal: order.totalAmount,
        },
      );
    } catch {
      // Don't fail cancellation if email fails
    }
    return order;
  }

  /** Update shipping address for registered user */
  async updateShippingAddress(
    orderId: string,
    userId: string,
    updateDto: UpdateShippingAddressDto,
  ) {
    const order = await this.orderModel.findOne({ orderId, userId });
    if (!order) throw new NotFoundException('Order not found');
    if (!this.canModify(order.status)) {
      throw new BadRequestException(
        `Cannot update shipping address for order with status: ${order.status}`,
      );
    }

    order.shippingAddress = updateDto.shippingAddress;
    order.notes.push({
      content: `Shipping address updated${updateDto.reason ? `: ${updateDto.reason}` : ''}`,
      source: 'system',
      authorId: userId,
      visibleToCustomer: true,
      createdAt: new Date(),
    });

    await order.save();
    return {
      success: true,
      orderId: order.orderId,
      message: 'Shipping address updated successfully',
      updatedAddress: order.shippingAddress,
    };
  }

  /** Add note to order for registered user */
  async addCustomerNote(
    orderId: string,
    userId: string,
    content: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId, userId });
    if (!order) throw new NotFoundException('Order not found');
    if (!this.canModify(order.status)) {
      throw new BadRequestException(
        `Cannot add notes to order with status: ${order.status}`,
      );
    }

    order.notes.push({
      content,
      source: 'customer',
      authorId: userId,
      visibleToCustomer: true,
      createdAt: new Date(),
    });
    return order.save();
  }

  /** Mock payment for testing */
  async mockPay(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.getOrderById(orderId, userId);
    if (order.isPaid) throw new BadRequestException('Order already paid');

    order.isPaid = true;
    order.status = OrderStatus.PAID;
    return order.save();
  }

  // ============================================================
  // GUEST OPERATIONS
  // ============================================================

  /** Create guest order - items sent directly from frontend */
  async createGuestOrder(dto: GuestCheckoutDto): Promise<GuestOrderDocument> {
    const guestOrder = await inTransaction(this.connection, async (session) => {
      const cart = await this.cartModel
        .findOne({ guestSessionId: dto.sessionId })
        .session(session);
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Validate items and get product details
      const validItems = await this.validateGuestItems(dto.items, session);
      await this.reduceStock(validItems, session);

      const [createdGuestOrder] = await this.guestOrderModel.create(
        [
          {
            orderId: generateOrderId(),
            customerInfo: dto.customerInfo,
            shippingAddress: dto.shippingAddress,
            billingAddress: dto.billingAddress,
            items: validItems.map((item) => ({
              productId: new Types.ObjectId(item.productId),
              quantity: item.quantity,
              priceAtPurchase: item.price,
            })),
            totalAmount,
            status: OrderStatus.PENDING,
            isPaid: false,
            notes: [],
            statusHistory: [
              {
                status: OrderStatus.PENDING,
                reason: 'Guest order created',
                updatedBy: 'system',
                createdAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );

      await guestOrder.populate('items.productId', 'name price images');

      return createdGuestOrder;
    });

    try {
      const { email, firstName, lastName } = guestOrder.customerInfo;
      await this.ordersEmailService.sendOrderConfirmationEmail(
        email,
        guestOrder.orderId,
        {
          totalAmount: guestOrder.totalAmount,
          itemCount: guestOrder.items.length,
          customerName: `${firstName} ${lastName}`,
        },
      );
    } catch {
      // Don't fail order creation if email fails
    }
    return guestOrder;
  }

  /** Validate guest checkout items and return with prices */
  private async validateGuestItems(
    items: Array<{ productId: string; quantity: number }>,
    session?: ClientSession,
  ) {
    const productIds = items
      .map((item) =>
        Types.ObjectId.isValid(item.productId)
          ? new Types.ObjectId(item.productId)
          : null,
      )
      .filter(Boolean) as Types.ObjectId[];

    if (!productIds.length) {
      throw new BadRequestException('No valid products in cart');
    }

    const products = await this.productModel
      .find({ _id: { $in: productIds }, availabilityStatus: 'In Stock' })
      .select('_id stock price')
      .session(session || null)
      .lean();

    if (!products.length) {
      throw new BadRequestException('All products are unavailable');
    }

    const productMap = new Map(
      products.map((p) => [
        p._id.toString(),
        { stock: p.stock, price: p.price },
      ]),
    );

    const validItems: Array<{
      productId: string;
      quantity: number;
      price: number;
    }> = [];
    const errors: string[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        errors.push(`Product ${item.productId} not found or unavailable`);
        continue;
      }
      if (product.stock < item.quantity) {
        errors.push(
          `${item.productId}: need ${item.quantity}, have ${product.stock}`,
        );
        continue;
      }
      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Stock issues: ${errors.join('; ')}`);
    }

    if (!validItems.length) {
      throw new BadRequestException('No valid items to order');
    }

    return validItems;
  }

  /** Track guest order by orderId and email */
  async trackGuestOrder(
    orderId: string,
    email: string,
  ): Promise<GuestOrderDocument> {
    const guestOrder = await this.guestOrderModel
      .findOne({
        orderId,
        'customerInfo.email': email,
      })
      .populate('items.productId', 'name price images');
    if (!guestOrder) throw new NotFoundException('Order not found');
    return guestOrder;
  }

  /** Cancel guest order (with transaction) */
  async cancelGuestOrder(
    orderId: string,
    email: string,
    reason?: string,
  ): Promise<GuestOrderDocument> {
    const guestOrder = await inTransaction(this.connection, async (session) => {
      const guestOrderDoc = await this.guestOrderModel
        .findOne({ orderId, 'customerInfo.email': email })
        .session(session);
      if (!guestOrderDoc) throw new NotFoundException('Order not found');
      if (!this.canCancel(guestOrderDoc.status)) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${guestOrderDoc.status}`,
        );
      }

      const previousStatus = guestOrderDoc.status;
      guestOrderDoc.status = OrderStatus.CANCELLED;
      guestOrderDoc.cancelledAt = new Date();
      guestOrderDoc.cancellationReason = reason;
      guestOrderDoc.statusHistory.push({
        status: OrderStatus.CANCELLED,
        previousStatus,
        reason: reason || 'Order cancelled by guest',
        updatedBy: 'guest',
        createdAt: new Date(),
      });
      guestOrderDoc.notes.push({
        content: `Order cancelled${reason ? `: ${reason}` : ''}`,
        source: 'system',
        visibleToCustomer: true,
        createdAt: new Date(),
      });

      await this.restoreStock(guestOrderDoc.items, session);
      return guestOrderDoc.save({ session });
    });

    try {
      const { firstName, lastName } = guestOrder.customerInfo;
      await this.ordersEmailService.sendCancellationConfirmationEmail(
        guestOrder.customerInfo.email,
        orderId,
        {
          customerName: `${firstName} ${lastName}`,
          refundAmount: 0,
          refundTimeline: 'Not applicable',
          cancellationReason: reason || 'Order cancelled by guest',
          orderTotal: guestOrder.totalAmount,
        },
      );
    } catch {
      // Don't fail cancellation if email fails
    }
    return guestOrder;
  }

  /** Update shipping address for guest order */
  async updateGuestShippingAddress(
    orderId: string,
    email: string,
    updateDto: UpdateShippingAddressDto,
  ) {
    const guestOrder = await this.guestOrderModel.findOne({
      orderId,
      'customerInfo.email': email,
    });
    if (!guestOrder) throw new NotFoundException('Order not found');
    if (!this.canModify(guestOrder.status)) {
      throw new BadRequestException(
        `Cannot update shipping address for order with status: ${guestOrder.status}`,
      );
    }

    guestOrder.shippingAddress = updateDto.shippingAddress;
    guestOrder.notes.push({
      content: `Shipping address updated${updateDto.reason ? `: ${updateDto.reason}` : ''}`,
      source: 'system',
      visibleToCustomer: true,
      createdAt: new Date(),
    });

    await guestOrder.save();
    return {
      success: true,
      orderId: guestOrder.orderId,
      message: 'Shipping address updated successfully',
      updatedAddress: guestOrder.shippingAddress,
    };
  }

  /** Add note to guest order */
  async addGuestNote(
    orderId: string,
    email: string,
    content: string,
  ): Promise<GuestOrderDocument> {
    const guestOrder = await this.guestOrderModel.findOne({
      orderId,
      'customerInfo.email': email,
    });
    if (!guestOrder) throw new NotFoundException('Order not found');
    if (!this.canModify(guestOrder.status)) {
      throw new BadRequestException(
        `Cannot add notes to order with status: ${guestOrder.status}`,
      );
    }

    guestOrder.notes.push({
      content,
      source: 'customer',
      visibleToCustomer: true,
      createdAt: new Date(),
    });
    return guestOrder.save();
  }

  // ============================================================
  // ADMIN OPERATIONS
  // ============================================================

  /** Get all orders - registered users only (paginated) */
  async getAllOrders(page = 1, limit = 20): Promise<PaginationResult<Order>> {
    return this.paginationService.paginate(this.orderModel, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: 'userId', select: 'firstName lastName email phone' },
        { path: 'items.productId', select: 'name price images' },
      ],
    });
  }

  /** Get all orders including guest orders (paginated) */
  async getAllOrdersIncludingGuest(page = 1, limit = 20) {
    const [regularResult, guestResult] = await Promise.all([
      this.paginationService.paginate(this.orderModel, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: [
          { path: 'userId', select: 'firstName lastName email phone' },
          { path: 'items.productId', select: 'name price images' },
        ],
      }),
      this.paginationService.paginate(this.guestOrderModel, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: [{ path: 'items.productId', select: 'name price images' }],
      }),
    ]);

    const allOrders = [
      ...regularResult.data.map((o) => ({ ...o, isGuestOrder: false })),
      ...guestResult.data.map((o) => ({ ...o, isGuestOrder: true })),
    ].sort(
      (a, b) =>
        new Date((b as any).createdAt).getTime() -
        new Date((a as any).createdAt).getTime(),
    );

    return {
      data: allOrders.slice(0, limit),
      total: regularResult.total + guestResult.total,
      page,
      limit,
      totalPages: Math.ceil((regularResult.total + guestResult.total) / limit),
      hasNext:
        page < Math.ceil((regularResult.total + guestResult.total) / limit),
      hasPrev: page > 1,
    };
  }

  /** Search orders with filters */
  async searchOrders(
    searchDto: AdminOrderSearchDto,
  ): Promise<AdminOrderListResponseDto> {
    const {
      orderId,
      userId,
      email,
      phone,
      customerName,
      status,
      startDate,
      endDate,
      guestOrdersOnly,
      registeredOrdersOnly,
      page = 1,
      limit = 20,
    } = searchDto;
    const skip = (page - 1) * limit;

    const dateFilter: any = {};
    if (startDate) dateFilter['$gte'] = new Date(startDate);
    if (endDate) dateFilter['$lte'] = new Date(endDate);

    const baseFilter: any = {
      ...(status && { status }),
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    let regularOrders: any[] = [];
    if (!guestOrdersOnly) {
      // Build the filter for regular orders
      const regularOrderFilter: any = {
        ...baseFilter,
        ...(orderId && { orderId: { $regex: orderId, $options: 'i' } }),
      };

      // Add userId filter - convert string to ObjectId for MongoDB query
      if (userId) {
        try {
          regularOrderFilter.userId = new Types.ObjectId(userId);
        } catch {
          // If invalid ObjectId format, use as-is (will return no results)
          regularOrderFilter.userId = userId;
        }
      }

      regularOrders = await this.orderModel
        .find(regularOrderFilter)
        .populate('userId', 'firstName lastName email phone')
        .populate('items.productId', 'name price images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    let guestOrders: any[] = [];
    if (!registeredOrdersOnly) {
      guestOrders = await this.guestOrderModel
        .find({
          ...baseFilter,
          ...(orderId && { orderId: { $regex: orderId, $options: 'i' } }),
          ...(email && {
            'customerInfo.email': { $regex: email, $options: 'i' },
          }),
          ...(phone && {
            'customerInfo.phone': { $regex: phone, $options: 'i' },
          }),
          ...(customerName && {
            $or: [
              {
                'customerInfo.firstName': {
                  $regex: customerName,
                  $options: 'i',
                },
              },
              {
                'customerInfo.lastName': {
                  $regex: customerName,
                  $options: 'i',
                },
              },
            ],
          }),
        })
        .populate('items.productId', 'name price images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const transformOrder = (
      order: any,
      isGuest: boolean,
    ): AdminOrderResponseDto => ({
      orderId: order.orderId,
      status: order.status,
      totalAmount: order.totalAmount,
      isPaid: order.isPaid,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isGuestOrder: isGuest,
      customer: isGuest
        ? {
            name: `${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
            email: order.customerInfo.email,
            phone: order.customerInfo.phone,
          }
        : {
            id: order.userId?._id?.toString(),
            name: order.userId
              ? `${order.userId.firstName} ${order.userId.lastName}`
              : 'Unknown',
            email: order.userId?.email || 'No email',
            phone: order.userId?.phone,
          },
      itemsCount: order.items?.length || 0,
      items: (order.items || []).map((item: any) => ({
        productId: item.productId?.toString() || null,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      })),
      ...(isGuest && { shippingAddress: order.shippingAddress }),
    });

    const allOrders = [
      ...regularOrders.map((o) => transformOrder(o, false)),
      ...guestOrders.map((o) => transformOrder(o, true)),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);

    const [regularCount, guestCount] = await Promise.all([
      guestOrdersOnly ? 0 : this.orderModel.countDocuments(baseFilter),
      registeredOrdersOnly
        ? 0
        : this.guestOrderModel.countDocuments(baseFilter),
    ]);

    return {
      orders: allOrders,
      pagination: {
        page,
        limit,
        total: regularCount + guestCount,
        totalPages: Math.ceil((regularCount + guestCount) / limit),
      },
    };
  }

  /** Get order details for admin */
  async getOrderDetailsForAdmin(
    orderId: string,
  ): Promise<AdminOrderResponseDto | null> {
    const regularOrder = await this.orderModel
      .findOne({ orderId })
      .populate('userId', 'firstName lastName email phone')
      .populate('items.productId', 'name price images')
      .lean();
    if (regularOrder) {
      return {
        orderId: regularOrder.orderId,
        status: regularOrder.status,
        totalAmount: regularOrder.totalAmount,
        isPaid: regularOrder.isPaid,
        createdAt: (regularOrder as any).createdAt,
        updatedAt: (regularOrder as any).updatedAt,
        isGuestOrder: false,
        customer: {
          id: (regularOrder as any).userId?._id?.toString(),
          name: (regularOrder as any).userId
            ? `${(regularOrder as any).userId.firstName} ${(regularOrder as any).userId.lastName}`
            : 'Unknown',
          email: (regularOrder as any).userId?.email || 'No email',
          phone: (regularOrder as any).userId?.phone,
        },
        itemsCount: regularOrder.items?.length || 0,
        items: (regularOrder.items || []).map((item: any) => ({
          productId:
            item.productId?._id?.toString() || item.productId?.toString(),
          productName: item.productId?.name,
          productImage: item.productId?.images?.[0],
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        })),
      };
    }

    const guestOrder = await this.guestOrderModel
      .findOne({ orderId })
      .populate('items.productId', 'name price images')
      .lean();
    if (guestOrder) {
      return {
        orderId: guestOrder.orderId,
        status: guestOrder.status,
        totalAmount: guestOrder.totalAmount,
        isPaid: guestOrder.isPaid,
        createdAt: (guestOrder as any).createdAt,
        updatedAt: (guestOrder as any).updatedAt,
        isGuestOrder: true,
        customer: {
          name: `${guestOrder.customerInfo.firstName} ${guestOrder.customerInfo.lastName}`,
          email: guestOrder.customerInfo.email,
          phone: guestOrder.customerInfo.phone,
        },
        itemsCount: guestOrder.items?.length || 0,
        items: (guestOrder.items || []).map((item: any) => ({
          productId:
            item.productId?._id?.toString() || item.productId?.toString(),
          productName: item.productId?.name,
          productImage: item.productId?.images?.[0],
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        })),
        shippingAddress: guestOrder.shippingAddress,
      };
    }

    return null;
  }

  /** Update order status (admin) - sends status update email to customer */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    updatedBy?: string,
    reason?: string,
    trackingNumber?: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) throw new NotFoundException('Order not found');

    const previousStatus = order.status;
    if (!this.isValidTransition(previousStatus, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${previousStatus} to ${status}`,
      );
    }

    order.status = status;
    order.statusHistory.push({
      status,
      previousStatus,
      reason: reason || 'Status updated by admin',
      updatedBy: updatedBy || 'admin',
      createdAt: new Date(),
    });
    const savedOrder = await order.save();

    try {
      const user = await this.usersService.findById(order.userId.toString());
      const frontendUrl = process.env.FRONTEND_URL || '';
      await this.ordersEmailService.sendOrderStatusUpdateEmail(
        user.email,
        orderId,
        {
          customerName: `${user.firstName} ${user.lastName}`,
          previousStatus,
          newStatus: status,
          adminMessage: reason,
          trackingNumber,
          totalAmount: order.totalAmount,
          orderTrackingUrl: frontendUrl
            ? `${frontendUrl}/orders?orderId=${orderId}`
            : undefined,
        },
      );
    } catch {
      // Don't fail status update if email fails
    }
    return savedOrder;
  }

  /**
   * Update order or guest order status (admin) with email notification.
   * Tries registered user order first, then guest order.
   */
  async updateOrderOrGuestStatusWithNotification(
    orderId: string,
    status: OrderStatus,
    adminMessage?: string,
    trackingNumber?: string,
  ): Promise<OrderDocument | GuestOrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      return this.updateOrderStatus(
        orderId,
        status,
        undefined,
        adminMessage,
        trackingNumber,
      );
    }
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      return this.updateGuestOrderStatusWithNotification(
        orderId,
        status,
        adminMessage,
        trackingNumber,
      );
    }
    throw new NotFoundException('Order not found');
  }

  /** Update guest order status (admin) */
  async updateGuestOrderStatus(
    orderId: string,
    status: OrderStatus,
    updatedBy?: string,
    reason?: string,
  ): Promise<GuestOrderDocument> {
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (!guestOrder) throw new NotFoundException('Guest order not found');

    const previousStatus = guestOrder.status;
    if (!this.isValidTransition(previousStatus, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${previousStatus} to ${status}`,
      );
    }

    guestOrder.status = status;
    guestOrder.statusHistory.push({
      status,
      previousStatus,
      reason: reason || 'Status updated by admin',
      updatedBy: updatedBy || 'admin',
      createdAt: new Date(),
    });
    return guestOrder.save();
  }

  /** Update any order status (regular or guest) with smart default reasons */
  async updateAnyOrderStatus(
    orderId: string,
    status: OrderStatus,
    updatedBy: string,
    reason?: string,
  ): Promise<OrderDocument | GuestOrderDocument> {
    const finalReason =
      reason ||
      this.DEFAULT_STATUS_REASONS[status] ||
      'Status updated by admin';

    // Try regular order first
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      return this.updateOrderStatus(orderId, status, updatedBy, finalReason);
    }

    // Try guest order
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      return this.updateGuestOrderStatus(
        orderId,
        status,
        updatedBy,
        finalReason,
      );
    }

    throw new NotFoundException('Order not found');
  }

  /** Add admin note to any order */
  async addAdminNote(
    orderId: string,
    adminId: string,
    content: string,
    visibleToCustomer = false,
  ): Promise<OrderDocument | GuestOrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      order.notes.push({
        content,
        source: 'admin',
        authorId: adminId,
        visibleToCustomer,
        createdAt: new Date(),
      });
      return order.save();
    }

    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      guestOrder.notes.push({
        content,
        source: 'admin',
        authorId: adminId,
        visibleToCustomer,
        createdAt: new Date(),
      });
      return guestOrder.save();
    }

    throw new NotFoundException('Order not found');
  }

  /** Get all notes for an order (admin view) */
  async getAllOrderNotes(orderId: string) {
    const order = await this.orderModel.findOne({ orderId });
    if (order) return order.notes;

    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) return guestOrder.notes;

    throw new NotFoundException('Order not found');
  }

  /** Delete a note from an order (admin only) */
  async deleteOrderNote(orderId: string, noteIndex: number) {
    // Try regular order first
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      if (noteIndex < 0 || noteIndex >= order.notes.length) {
        throw new BadRequestException('Invalid note index');
      }
      order.notes.splice(noteIndex, 1);
      await order.save();
      return order.notes;
    }

    // Try guest order
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      if (noteIndex < 0 || noteIndex >= guestOrder.notes.length) {
        throw new BadRequestException('Invalid note index');
      }
      guestOrder.notes.splice(noteIndex, 1);
      await guestOrder.save();
      return guestOrder.notes;
    }

    throw new NotFoundException('Order not found');
  }

  /** Get status history for an order */
  async getStatusHistory(orderId: string) {
    const order = await this.orderModel.findOne({ orderId });
    if (order) return order.statusHistory;

    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) return guestOrder.statusHistory;

    throw new NotFoundException('Order not found');
  }

  /** Update guest order status with email notification */
  async updateGuestOrderStatusWithNotification(
    orderId: string,
    newStatus: OrderStatus,
    adminMessage?: string,
    trackingNumber?: string,
  ): Promise<GuestOrderDocument> {
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (!guestOrder) throw new NotFoundException('Guest order not found');

    const previousStatus = guestOrder.status;
    if (!this.isValidTransition(previousStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${previousStatus} to ${newStatus}`,
      );
    }

    guestOrder.status = newStatus;
    guestOrder.statusHistory.push({
      status: newStatus,
      previousStatus,
      reason: adminMessage || 'Status updated by admin',
      updatedBy: 'admin',
      createdAt: new Date(),
    });

    const updatedOrder = await guestOrder.save();

    await this.ordersEmailService.sendOrderStatusUpdateEmail(
      guestOrder.customerInfo.email,
      orderId,
      {
        customerName: `${guestOrder.customerInfo.firstName} ${guestOrder.customerInfo.lastName}`,
        previousStatus,
        newStatus,
        adminMessage,
        trackingNumber,
        totalAmount: guestOrder.totalAmount,
        orderTrackingUrl: `${process.env.FRONTEND_URL}/track-order?orderId=${orderId}&email=${guestOrder.customerInfo.email}`,
      },
    );

    return updatedOrder;
  }

  /** Find guest orders by email (paginated) */
  async findGuestOrdersByEmail(
    email: string,
    page = 1,
    limit = 20,
  ): Promise<PaginationResult<GuestOrder>> {
    return this.paginationService.paginate(this.guestOrderModel, {
      page,
      limit,
      filter: { 'customerInfo.email': { $regex: email, $options: 'i' } },
      sort: { createdAt: -1 },
      populate: [{ path: 'items.productId', select: 'name price images' }],
    });
  }

  /** Find guest orders by phone (paginated) */
  async findGuestOrdersByPhone(
    phone: string,
    page = 1,
    limit = 20,
  ): Promise<PaginationResult<GuestOrder>> {
    return this.paginationService.paginate(this.guestOrderModel, {
      page,
      limit,
      filter: { 'customerInfo.phone': { $regex: phone, $options: 'i' } },
      sort: { createdAt: -1 },
      populate: [{ path: 'items.productId', select: 'name price images' }],
    });
  }

  /** Get guest order fulfillment info */
  async getGuestOrderFulfillmentInfo(orderId: string) {
    const guestOrder = await this.guestOrderModel
      .findOne({ orderId })
      .populate('items.productId', 'name price images')
      .lean();
    if (!guestOrder) throw new NotFoundException('Guest order not found');

    return {
      orderId: guestOrder.orderId,
      status: guestOrder.status,
      isPaid: guestOrder.isPaid,
      customerInfo: guestOrder.customerInfo,
      shippingAddress: guestOrder.shippingAddress,
      billingAddress: guestOrder.billingAddress,
      items: guestOrder.items,
      totalAmount: guestOrder.totalAmount,
      createdAt: (guestOrder as any).createdAt,
      updatedAt: (guestOrder as any).updatedAt,
      fulfillmentNotes: {
        requiresShipping: true,
        customerType: 'guest',
        contactEmail: guestOrder.customerInfo.email,
        contactPhone: guestOrder.customerInfo.phone,
        shippingLabel: `${guestOrder.customerInfo.firstName} ${guestOrder.customerInfo.lastName}\n${guestOrder.shippingAddress.street}\n${guestOrder.shippingAddress.city}, ${guestOrder.shippingAddress.state} ${guestOrder.shippingAddress.postalCode}\n${guestOrder.shippingAddress.country}`,
      },
    };
  }
}
