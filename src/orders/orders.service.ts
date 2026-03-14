import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

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
import { FulfillmentGroupingService } from './services/fulfillment-grouping.service';
import { UpdateShippingAddressDto } from './dto/update-shipping-address.dto';
import { PaginationService } from '../shared/services/pagination/services/pagination.service';
import type { PaginationResult } from '../shared/services/pagination/interfaces/pagination.interface';
import { UsersService } from '../users/users.service';
import { PaymentSettingsService } from '../payment-settings/payment-settings.service';
import { DeliveryTimeUnit } from '../product/enums/delivery-time-unit.enum';
import { FulfillmentStatus } from './enums/fulfillment-status.enum';
import { FulfillmentType } from './enums/fulfillment-type.enum';
import {
  ShippingCarrier,
  generateTrackingUrl as generateCarrierTrackingUrl,
} from './enums/shipping-carrier.enum';
import { AvailabilityStatus } from 'src/product/enums/availabilty-status.enum';
import type { Address } from './interfaces/order.interface';
import { StripeService } from '../shared/services/stripe/stripe.service';
import { PaymentMethod } from './enums/payment-method.enum';
import { config } from '../config';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
    private readonly fulfillmentGroupingService: FulfillmentGroupingService,
    private readonly paginationService: PaginationService,
    private readonly usersService: UsersService,
    private readonly paymentSettingsService: PaymentSettingsService,
    private readonly stripeService: StripeService,
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
      .select('_id stock deliveryTimeUnit deliveryMinTime deliveryMaxTime')
      .session(session || null)
      .lean();

    if (!products.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    const productDataMap = new Map(
      products.map((p) => [
        p._id.toString(),
        {
          stock: p.stock,
          deliveryTimeUnit: p.deliveryTimeUnit,
          deliveryMinTime: p.deliveryMinTime,
          deliveryMaxTime: p.deliveryMaxTime,
        },
      ]),
    );
    const validItems: Array<{
      productId: any;
      quantity: number;
      priceAtAddedTime: number;
      selectedAttributes?: Record<string, any>;
      deliveryTimeUnit?: DeliveryTimeUnit;
      deliveryMinTime?: number;
      deliveryMaxTime?: number;
    }> = [];
    const outOfStockItems: Array<{
      productId: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of cart.items) {
      const productId = item.productId.toString();
      const productData = productDataMap.get(productId);

      if (productData === undefined) continue;
      if (productData.stock < item.quantity) {
        outOfStockItems.push({
          productId,
          requested: item.quantity,
          available: productData.stock,
        });
        continue;
      }
      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtAddedTime: item.priceAtAddedTime,
        selectedAttributes: item.selectedAttributes || {},
        deliveryTimeUnit: productData.deliveryTimeUnit,
        deliveryMinTime: productData.deliveryMinTime,
        deliveryMaxTime: productData.deliveryMaxTime,
      });
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
      const product = await this.productModel
        .findById(item.productId)
        .session(session || null);
      if (!product) continue;

      const newStock = Math.max(0, product.stock - item.quantity);
      const updateData: any = { stock: newStock };

      // Automatically change status to Out of Stock if stock reaches 0
      if (newStock === 0) {
        updateData.availabilityStatus = 'Out of Stock';
      }

      await this.productModel.updateOne(
        { _id: item.productId },
        { $set: updateData },
        { session },
      );
    }
  }

  private async restoreStock(
    items: Array<{ productId: any; quantity: number }>,
    session?: ClientSession,
  ) {
    for (const item of items) {
      const product = await this.productModel
        .findById(item.productId)
        .session(session || null);
      if (!product) continue;

      const newStock = product.stock + item.quantity;
      const updateData: any = { stock: newStock };

      // Automatically change status back to In Stock if stock was 0 and is now > 0
      if (
        product.stock === 0 &&
        newStock > 0 &&
        product.availabilityStatus === AvailabilityStatus.OUT_OF_STOCK
      ) {
        updateData.availabilityStatus = AvailabilityStatus.IN_STOCK;
      }

      await this.productModel.updateOne(
        { _id: item.productId },
        { $set: updateData },
        { session },
      );
    }
  }

  // ============================================================
  // CUSTOMER OPERATIONS
  // ============================================================

  /** Create order from cart for registered user (with transaction) */
  async createOrder(
    userId: string,
    shippingAddress?: Address,
    billingAddress?: Address,
    paymentMethod?: PaymentMethod,
    deliveryFee?: number,
  ): Promise<OrderDocument> {
    const recentOrder = await this.orderModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: OrderStatus.PENDING,
        createdAt: { $gte: new Date(Date.now() - 30000) }, // Last 30 seconds
      })
      .sort({ createdAt: -1 })
      .exec();

    if (recentOrder) {
      this.logger.warn(
        `Duplicate order attempt detected for user ${userId}. Returning existing order ${recentOrder.orderId}`,
      );
      return recentOrder;
    }

    const order = await inTransaction(this.connection, async (session) => {
      const cart = await this.cartModel.findOne({ userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const validItems = await this.validateAndGetCartItems(cart, session);
      await this.reduceStock(validItems, session);

      // Create order items with delivery timeline captured from products
      const orderItems = validItems.map((item) => ({
        productId: new Types.ObjectId(item.productId),
        quantity: item.quantity,
        priceAtPurchase: item.priceAtAddedTime,
        selectedAttributes: item.selectedAttributes || {},
        deliveryTimeUnit: item.deliveryTimeUnit,
        deliveryMinTime: item.deliveryMinTime,
        deliveryMaxTime: item.deliveryMaxTime,
      }));

      // Group items into fulfillments based on delivery timeline
      const fulfillments =
        this.fulfillmentGroupingService.groupItemsIntoFulfillments(
          orderItems as any,
        );

      // Calculate total amount including delivery fee
      const orderSubtotal = cart.totalAmount;
      const orderDeliveryFee = deliveryFee || 0;
      const totalAmount = orderSubtotal + orderDeliveryFee;

      const [order] = await this.orderModel.create(
        [
          {
            orderId: generateOrderId(),
            userId: new Types.ObjectId(userId),
            items: orderItems,
            fulfillments,
            orderSubtotal: orderSubtotal,
            totalAmount: totalAmount,
            status: OrderStatus.PENDING,
            isPaid: false,
            paymentMethod: paymentMethod || PaymentMethod.E_TRANSFER,
            deliveryFee: orderDeliveryFee,
            shippingAddress,
            billingAddress,
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

      this.logger.log(`Order created: ${order.orderId}`);

      await order.populate([
        { path: 'userId', select: 'firstName lastName email phone' },
        { path: 'items.productId', select: 'name price images' },
      ]);

      return order;
    });

    try {
      const user = await this.usersService.findById(userId);
      const emailData = this.ordersEmailService.prepareOrderConfirmationData(
        order,
        user,
      );

      // Send emails asynchronously without blocking the response
      Promise.all([
        this.ordersEmailService.sendOrderConfirmationEmail(
          user.email,
          order.orderId,
          emailData,
          false,
        ),
        (async () => {
          const settings = await this.paymentSettingsService.getSettings();
          return this.ordersEmailService.sendAdminOrderNotification(
            settings.eTransferEmail,
            order.orderId,
            order.totalAmount,
            `${user.firstName} ${user.lastName}`,
            user.email,
          );
        })(),
      ]).catch((error) => {
        this.logger.warn(
          `Failed to send order emails for ${order.orderId}: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `Failed to prepare order emails for ${order.orderId}: ${error.message}`,
      );
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
      populate: [
        { path: 'userId', select: 'firstName lastName email phone' },
        { path: 'items.productId', select: 'name price images' },
      ],
    });
  }

  /** Get single order for a registered user */
  async getOrderById(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({ orderId, userId })
      .populate('userId', 'firstName lastName email phone')
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
    order.status = OrderStatus.CONFIRMED;
    return order.save();
  }

  async mockPayGuest(orderId: string): Promise<GuestOrderDocument> {
    const order = await this.guestOrderModel.findOne({ orderId });

    if (!order) {
      throw new NotFoundException(`Guest order with ID ${orderId} not found`);
    }

    if (order.isPaid) {
      throw new BadRequestException('Guest order already paid');
    }

    order.isPaid = true;
    order.status = OrderStatus.CONFIRMED;

    const saved = await order.save();

    return saved;
  }

  // ============================================================
  // GUEST OPERATIONS
  // ============================================================

  /** Create guest order - items sent directly from frontend */
  async createGuestOrder(dto: GuestCheckoutDto): Promise<GuestOrderDocument> {
    const recentOrder = await this.guestOrderModel
      .findOne({
        'customerInfo.email': dto.customerInfo.email,
        status: OrderStatus.PENDING,
        createdAt: { $gte: new Date(Date.now() - 30000) },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (recentOrder) {
      this.logger.warn(
        `Duplicate guest order attempt detected for ${dto.customerInfo.email}. Returning existing order ${recentOrder.orderId}`,
      );
      return recentOrder;
    }

    const guestOrder = await inTransaction(this.connection, async (session) => {
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const validItems = await this.validateGuestItems(dto.items, session);
      await this.reduceStock(validItems, session);

      const orderSubtotal = validItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // Calculate total amount including delivery fee
      const orderDeliveryFee = dto.deliveryFee || 0;
      const totalAmount = orderSubtotal + orderDeliveryFee;

      // Create order items with delivery timeline captured from products
      const orderItems = validItems.map((item) => ({
        productId: new Types.ObjectId(item.productId),
        quantity: item.quantity,
        priceAtPurchase: item.price,
        selectedAttributes: item.selectedAttributes || {},
        deliveryTimeUnit: item.deliveryTimeUnit,
        deliveryMinTime: item.deliveryMinTime,
        deliveryMaxTime: item.deliveryMaxTime,
      }));

      // Group items into fulfillments based on delivery timeline
      const fulfillments =
        this.fulfillmentGroupingService.groupItemsIntoFulfillments(
          orderItems as any,
        );

      const [guestOrder] = await this.guestOrderModel.create(
        [
          {
            orderId: generateOrderId(),
            customerInfo: dto.customerInfo,
            shippingAddress: dto.shippingAddress,
            billingAddress: dto.billingAddress,
            items: orderItems,
            fulfillments,
            orderSubtotal: orderSubtotal,
            totalAmount,
            status: OrderStatus.PENDING,
            paymentMethod: dto.paymentMethod || PaymentMethod.E_TRANSFER,
            isPaid: false,
            deliveryFee: orderDeliveryFee,
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

      this.logger.log(`Guest order created: ${guestOrder.orderId}`);

      await guestOrder.populate('items.productId', 'name price images');
      return guestOrder;
    });

    try {
      const { email, firstName, lastName } = guestOrder.customerInfo;
      const emailData = this.ordersEmailService.prepareOrderConfirmationData(
        guestOrder,
        guestOrder.customerInfo,
      );

      // Send emails asynchronously without blocking the response
      Promise.all([
        this.ordersEmailService.sendOrderConfirmationEmail(
          email,
          guestOrder.orderId,
          emailData,
          true,
        ),
        (async () => {
          const settings = await this.paymentSettingsService.getSettings();
          return this.ordersEmailService.sendAdminOrderNotification(
            settings.eTransferEmail,
            guestOrder.orderId,
            guestOrder.totalAmount,
            `${firstName} ${lastName}`,
            email,
          );
        })(),
      ]).catch((error) => {
        this.logger.warn(
          `Failed to send guest order emails for ${guestOrder.orderId}: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `Failed to prepare guest order emails for ${guestOrder.orderId}: ${error.message}`,
      );
    }
    return guestOrder;
  }

  /** Validate guest checkout items and return with prices */
  private async validateGuestItems(
    items: Array<{
      productId: string;
      quantity: number;
      selectedAttributes?: Record<string, string>;
    }>,
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
      .select(
        '_id stock price attributes deliveryTimeUnit deliveryMinTime deliveryMaxTime',
      )
      .populate('attributes')
      .session(session || null)
      .lean();

    if (!products.length) {
      throw new BadRequestException('All products are unavailable');
    }

    const productMap = new Map(
      products.map((p) => [
        p._id.toString(),
        {
          stock: p.stock,
          price: p.price,
          attributes: p.attributes,
          deliveryTimeUnit: p.deliveryTimeUnit,
          deliveryMinTime: p.deliveryMinTime,
          deliveryMaxTime: p.deliveryMaxTime,
        },
      ]),
    );

    const validItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      selectedAttributes?: Record<string, string>;
      deliveryTimeUnit?: DeliveryTimeUnit;
      deliveryMinTime?: number;
      deliveryMaxTime?: number;
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

      // Calculate price based on selected attributes/options (same logic as cart service)
      let finalPrice = product.price;
      if (item.selectedAttributes && product.attributes) {
        for (const attr of product.attributes as any[]) {
          const selected = item.selectedAttributes[attr.name];
          if (selected) {
            if (attr.type === 'single') {
              const selectedOption = attr.options?.find((opt: any) => {
                const optionName = typeof opt === 'string' ? opt : opt.name;
                return optionName === selected;
              });

              if (
                selectedOption &&
                typeof selectedOption === 'object' &&
                selectedOption.price
              ) {
                finalPrice += selectedOption.price;
              }
            } else if (attr.type === 'multiple') {
              // Handle comma-separated string from frontend
              const selectedValues = selected.split(',').map((v) => v.trim());
              for (const sel of selectedValues) {
                const selectedOption = attr.options?.find((opt: any) => {
                  const optionName = typeof opt === 'string' ? opt : opt.name;
                  return optionName === sel;
                });

                if (
                  selectedOption &&
                  typeof selectedOption === 'object' &&
                  selectedOption.price
                ) {
                  finalPrice += selectedOption.price;
                }
              }
            }
          }
        }
      }

      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: finalPrice,
        selectedAttributes: item.selectedAttributes || {},
        deliveryTimeUnit: product.deliveryTimeUnit,
        deliveryMinTime: product.deliveryMinTime,
        deliveryMaxTime: product.deliveryMaxTime,
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
    return inTransaction(this.connection, async (session) => {
      const guestOrder = await this.guestOrderModel
        .findOne({ orderId, 'customerInfo.email': email })
        .session(session);
      if (!guestOrder) throw new NotFoundException('Order not found');
      if (!this.canCancel(guestOrder.status)) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${guestOrder.status}`,
        );
      }

      const previousStatus = guestOrder.status;
      guestOrder.status = OrderStatus.CANCELLED;
      guestOrder.cancelledAt = new Date();
      guestOrder.cancellationReason = reason;
      guestOrder.statusHistory.push({
        status: OrderStatus.CANCELLED,
        previousStatus,
        reason: reason || 'Order cancelled by guest',
        updatedBy: 'guest',
        createdAt: new Date(),
      });
      guestOrder.notes.push({
        content: `Order cancelled${reason ? `: ${reason}` : ''}`,
        source: 'system',
        visibleToCustomer: true,
        createdAt: new Date(),
      });

      await this.restoreStock(guestOrder.items, session);
      return guestOrder.save({ session });
    });
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
      paymentMethod,
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
      ...(paymentMethod && { paymentMethod }),
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
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      stripeSessionId: order.stripeSessionId,
      paymentIntentId: order.paymentIntentId,
      stripeAmount: order.stripeAmount,
      stripeCurrency: order.stripeCurrency,
      processingFee: order.processingFee,
      orderSubtotal: order.orderSubtotal,
      deliveryFee: order.deliveryFee,
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

  /** Confirm order (Admin only) */
  async confirmOrder(
    orderId: string,
    adminId: string,
  ): Promise<Order | GuestOrder> {
    let order: OrderDocument | GuestOrderDocument | null =
      await this.orderModel.findOne({ orderId });
    let isGuest = false;

    if (!order) {
      order = await this.guestOrderModel.findOne({ orderId });
      isGuest = true;
    }

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order can only be confirmed when PENDING`);
    }

    const previousStatus = order.status;

    // Update order status and payment info
    order.status = OrderStatus.CONFIRMED;
    order.isPaid = true;
    order.paidAt = new Date();

    // Update all fulfillments to processing
    if (order.fulfillments && order.fulfillments.length > 0) {
      for (const fulfillment of order.fulfillments) {
        if (fulfillment.status === FulfillmentStatus.PENDING) {
          fulfillment.status = FulfillmentStatus.PROCESSING;
        }
      }
    }

    // Add status history
    order.statusHistory.push({
      status: OrderStatus.CONFIRMED,
      previousStatus,
      createdAt: new Date(),
      updatedBy: adminId,
      reason: 'Payment confirmed by admin',
    });

    await order.save();

    // Send payment confirmation email (order confirmation with payment confirmed message)
    // Send asynchronously without blocking the response
    try {
      if (!isGuest) {
        const user = await this.usersService.findById(
          (order as OrderDocument).userId.toString(),
        );
        const emailData = this.ordersEmailService.prepareOrderConfirmationData(
          order,
          user,
        );

        // Override the default message to indicate payment is confirmed
        this.ordersEmailService
          .sendOrderConfirmationEmail(
            user.email,
            order.orderId,
            {
              ...emailData,
              specialInstructions:
                '✓ Payment Confirmed: Your order is now being processed and will be shipped soon.',
            },
            false,
          )
          .catch((error) => {
            this.logger.warn(
              `Failed to send payment confirmation email for ${order.orderId}: ${error.message}`,
            );
          });
      } else {
        const guestOrder = order as GuestOrderDocument;
        const emailData = this.ordersEmailService.prepareOrderConfirmationData(
          order,
          guestOrder.customerInfo,
        );

        // Override the default message to indicate payment is confirmed
        this.ordersEmailService
          .sendOrderConfirmationEmail(
            guestOrder.customerInfo.email,
            guestOrder.orderId,
            {
              ...emailData,
              specialInstructions:
                '✓ Payment Confirmed: Your order is now being processed and will be shipped soon.',
            },
            true,
          )
          .catch((error) => {
            this.logger.warn(
              `Failed to send payment confirmation email for ${guestOrder.orderId}: ${error.message}`,
            );
          });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to prepare payment confirmation email for ${order.orderId}: ${error.message}`,
      );
    }

    return order;
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
          deliveryTimeUnit: item.deliveryTimeUnit,
          deliveryMinTime: item.deliveryMinTime,
          deliveryMaxTime: item.deliveryMaxTime,
        })),
        fulfillments: (regularOrder as any).fulfillments || [],
        shippingAddress: (regularOrder as any).shippingAddress,
        notes: (regularOrder as any).notes || [],
        statusHistory: (regularOrder as any).statusHistory || [],
        paymentMethod: (regularOrder as any).paymentMethod,
        paidAt: (regularOrder as any).paidAt,
        stripeSessionId: (regularOrder as any).stripeSessionId,
        paymentIntentId: (regularOrder as any).paymentIntentId,
        stripeAmount: (regularOrder as any).stripeAmount,
        stripeCurrency: (regularOrder as any).stripeCurrency,
        processingFee: (regularOrder as any).processingFee,
        orderSubtotal: (regularOrder as any).orderSubtotal,
        deliveryFee: (regularOrder as any).deliveryFee,
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
          deliveryTimeUnit: item.deliveryTimeUnit,
          deliveryMinTime: item.deliveryMinTime,
          deliveryMaxTime: item.deliveryMaxTime,
        })),
        fulfillments: (guestOrder as any).fulfillments || [],
        shippingAddress: guestOrder.shippingAddress,
        notes: (guestOrder as any).notes || [],
        statusHistory: (guestOrder as any).statusHistory || [],
        paymentMethod: (guestOrder as any).paymentMethod,
        paidAt: (guestOrder as any).paidAt,
        stripeSessionId: (guestOrder as any).stripeSessionId,
        paymentIntentId: (guestOrder as any).paymentIntentId,
        stripeAmount: (guestOrder as any).stripeAmount,
        stripeCurrency: (guestOrder as any).stripeCurrency,
        processingFee: (guestOrder as any).processingFee,
        orderSubtotal: (guestOrder as any).orderSubtotal,
        deliveryFee: (guestOrder as any).deliveryFee,
      };
    }

    return null;
  }

  /**
   * Update order status (admin only) - unified method for both regular and guest orders
   * Handles stock restoration on cancellation and sends email notifications
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    adminMessage?: string,
  ): Promise<{
    order: OrderDocument | GuestOrderDocument;
    isGuestOrder: boolean;
  }> {
    // Try regular order first
    const regularOrder = await this.orderModel.findOne({ orderId });
    if (regularOrder) {
      const result = await this.updateRegularOrderStatus(
        regularOrder,
        status,
        adminMessage,
      );
      return { order: result, isGuestOrder: false };
    }

    // Try guest order
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      const result = await this.updateGuestOrderStatusInternal(
        guestOrder,
        status,
        adminMessage,
      );
      return { order: result, isGuestOrder: true };
    }

    throw new NotFoundException('Order not found');
  }

  /** Internal: Update regular order status */
  private async updateRegularOrderStatus(
    order: OrderDocument,
    status: OrderStatus,
    adminMessage?: string,
  ): Promise<OrderDocument> {
    return inTransaction(this.connection, async (session) => {
      const orderDoc = await this.orderModel
        .findById(order._id)
        .session(session);
      if (!orderDoc) throw new NotFoundException('Order not found');

      const previousStatus = orderDoc.status;
      if (!this.isValidTransition(previousStatus, status)) {
        throw new BadRequestException(
          `Invalid status transition from ${previousStatus} to ${status}`,
        );
      }

      // Restore stock if cancelling
      if (
        status === OrderStatus.CANCELLED &&
        previousStatus !== OrderStatus.CANCELLED
      ) {
        await this.restoreStock(orderDoc.items, session);
        orderDoc.cancelledAt = new Date();
        orderDoc.cancellationReason = adminMessage || 'Cancelled by admin';
      }

      const reason =
        adminMessage ||
        this.DEFAULT_STATUS_REASONS[status] ||
        'Status updated by admin';
      orderDoc.status = status;
      orderDoc.statusHistory.push({
        status,
        previousStatus,
        reason,
        updatedBy: 'admin',
        createdAt: new Date(),
      });

      const updatedOrder = await orderDoc.save({ session });

      // Send email notification only for major status changes (non-blocking)
      const majorStatuses = [
        OrderStatus.PAID,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ];

      if (majorStatuses.includes(status)) {
        this.sendStatusUpdateEmailToUser(
          orderDoc.userId.toString(),
          order.orderId,
          previousStatus,
          status,
          adminMessage,
        );
      }

      return updatedOrder;
    });
  }

  /** Internal: Update guest order status */
  private async updateGuestOrderStatusInternal(
    guestOrder: GuestOrderDocument,
    status: OrderStatus,
    adminMessage?: string,
  ): Promise<GuestOrderDocument> {
    return inTransaction(this.connection, async (session) => {
      const orderDoc = await this.guestOrderModel
        .findById(guestOrder._id)
        .session(session);
      if (!orderDoc) throw new NotFoundException('Guest order not found');

      const previousStatus = orderDoc.status;
      if (!this.isValidTransition(previousStatus, status)) {
        throw new BadRequestException(
          `Invalid status transition from ${previousStatus} to ${status}`,
        );
      }

      // Restore stock if cancelling
      if (
        status === OrderStatus.CANCELLED &&
        previousStatus !== OrderStatus.CANCELLED
      ) {
        await this.restoreStock(orderDoc.items, session);
        orderDoc.cancelledAt = new Date();
        orderDoc.cancellationReason = adminMessage || 'Cancelled by admin';
      }

      const reason =
        adminMessage ||
        this.DEFAULT_STATUS_REASONS[status] ||
        'Status updated by admin';
      orderDoc.status = status;
      orderDoc.statusHistory.push({
        status,
        previousStatus,
        reason,
        updatedBy: 'admin',
        createdAt: new Date(),
      });

      const updatedOrder = await orderDoc.save({ session });

      // Send email notification only for major status changes (non-blocking)
      const majorStatuses = [
        OrderStatus.PAID,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ];

      if (majorStatuses.includes(status)) {
        this.sendStatusUpdateEmailToGuest(
          orderDoc,
          previousStatus,
          status,
          adminMessage,
        );
      }

      return updatedOrder;
    });
  }

  /** Helper: Send status update email to registered user */
  private async sendStatusUpdateEmailToUser(
    userId: string,
    orderId: string,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
    adminMessage?: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      await this.ordersEmailService.sendOrderStatusUpdateEmail(
        user.email,
        orderId,
        {
          customerName: `${user.firstName} ${user.lastName}`,
          previousStatus,
          newStatus,
          adminMessage,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send status update email for order ${orderId}: ${error.message}`,
      );
    }
  }

  /** Helper: Send status update email to guest */
  private async sendStatusUpdateEmailToGuest(
    guestOrder: GuestOrderDocument,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
    adminMessage?: string,
  ): Promise<void> {
    try {
      await this.ordersEmailService.sendOrderStatusUpdateEmail(
        guestOrder.customerInfo.email,
        guestOrder.orderId,
        {
          customerName: `${guestOrder.customerInfo.firstName} ${guestOrder.customerInfo.lastName}`,
          previousStatus,
          newStatus,
          adminMessage,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send status update email for guest order ${guestOrder.orderId}: ${error.message}`,
      );
    }
  }

  /** Helper: Send fulfillment status email to registered user */
  private async sendFulfillmentStatusEmailToUser(
    userId: string,
    orderId: string,
    fulfillmentIndex: number,
    fulfillment: any,
    status: FulfillmentStatus,
    totalFulfillments: number,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      const isShipped = status === FulfillmentStatus.IN_TRANSIT;
      const shipmentLabel =
        totalFulfillments > 1
          ? `Shipment ${fulfillmentIndex + 1} of ${totalFulfillments}`
          : 'Your order';

      await this.ordersEmailService.sendOrderStatusUpdateEmail(
        user.email,
        orderId,
        {
          customerName: `${user.firstName} ${user.lastName}`,
          previousStatus: isShipped ? 'processing' : 'in_transit',
          newStatus: status,
          trackingNumber: fulfillment.trackingNumber,
          trackingUrl: fulfillment.trackingUrl,
          carrier: fulfillment.carrier,
          estimatedDelivery: fulfillment.estimatedDeliveryDate,
          fulfillmentLabel: shipmentLabel,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send fulfillment email for order ${orderId}: ${error.message}`,
      );
    }
  }

  /** Helper: Send fulfillment status email to guest */
  private async sendFulfillmentStatusEmailToGuest(
    guestOrder: GuestOrderDocument,
    fulfillmentIndex: number,
    fulfillment: any,
    status: FulfillmentStatus,
  ): Promise<void> {
    try {
      const isShipped = status === FulfillmentStatus.IN_TRANSIT;
      const totalFulfillments = guestOrder.fulfillments.length;
      const shipmentLabel =
        totalFulfillments > 1
          ? `Shipment ${fulfillmentIndex + 1} of ${totalFulfillments}`
          : 'Your order';

      await this.ordersEmailService.sendOrderStatusUpdateEmail(
        guestOrder.customerInfo.email,
        guestOrder.orderId,
        {
          customerName: `${guestOrder.customerInfo.firstName} ${guestOrder.customerInfo.lastName}`,
          previousStatus: isShipped ? 'processing' : 'in_transit',
          newStatus: status,
          trackingNumber: fulfillment.trackingNumber,
          trackingUrl: fulfillment.trackingUrl,
          carrier: fulfillment.carrier,
          estimatedDelivery: fulfillment.estimatedDeliveryDate,
          fulfillmentLabel: shipmentLabel,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send fulfillment email for guest order ${guestOrder.orderId}: ${error.message}`,
      );
    }
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

  // ============================================================
  // FULFILLMENT MANAGEMENT (Admin)
  // ============================================================

  /**
   * Update fulfillment status for an order (admin only)
   * Validates status transition and recalculates order status
   */
  async updateFulfillmentStatus(
    orderId: string,
    fulfillmentIndex: number,
    status: FulfillmentStatus,
    reason?: string,
  ): Promise<{
    order: OrderDocument | GuestOrderDocument;
    isGuestOrder: boolean;
  }> {
    // Try regular order first
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      this.validateFulfillmentIndex(order.fulfillments, fulfillmentIndex);
      const fulfillment = order.fulfillments[fulfillmentIndex];
      const previousStatus = fulfillment.status;

      if (
        !this.fulfillmentGroupingService.isValidStatusTransition(
          previousStatus,
          status,
        )
      ) {
        throw new BadRequestException(
          `Invalid fulfillment status transition from ${previousStatus} to ${status}`,
        );
      }

      // Require tracking info for STANDARD shipping when marking as in_transit
      if (
        status === FulfillmentStatus.IN_TRANSIT &&
        fulfillment.type === FulfillmentType.STANDARD &&
        !fulfillment.trackingNumber
      ) {
        throw new BadRequestException(
          'Tracking information is required before marking STANDARD shipping as "In Transit". Please add tracking details first.',
        );
      }

      fulfillment.status = status;
      fulfillment.statusHistory.push({
        status,
        previousStatus,
        reason: reason || `Status updated to ${status}`,
        updatedBy: 'admin',
        createdAt: new Date(),
      });

      // Recalculate order status based on all fulfillments
      order.status = this.fulfillmentGroupingService.computeOrderStatus(
        order.fulfillments,
      );

      await order.save();

      // Send email for major fulfillment status changes (non-blocking)
      const majorFulfillmentStatuses = [
        FulfillmentStatus.IN_TRANSIT,
        FulfillmentStatus.DELIVERED,
        FulfillmentStatus.READY_FOR_PICKUP,
        FulfillmentStatus.CANCELLED,
      ];

      if (majorFulfillmentStatuses.includes(status)) {
        this.sendFulfillmentStatusEmailToUser(
          order.userId.toString(),
          orderId,
          fulfillmentIndex,
          fulfillment,
          status,
          order.fulfillments.length,
        );
      }

      return { order, isGuestOrder: false };
    }

    // Try guest order
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      this.validateFulfillmentIndex(guestOrder.fulfillments, fulfillmentIndex);
      const fulfillment = guestOrder.fulfillments[fulfillmentIndex];
      const previousStatus = fulfillment.status;

      if (
        !this.fulfillmentGroupingService.isValidStatusTransition(
          previousStatus,
          status,
        )
      ) {
        throw new BadRequestException(
          `Invalid fulfillment status transition from ${previousStatus} to ${status}`,
        );
      }

      // Require tracking info for STANDARD shipping when marking as in_transit
      if (
        status === FulfillmentStatus.IN_TRANSIT &&
        fulfillment.type === FulfillmentType.STANDARD &&
        !fulfillment.trackingNumber
      ) {
        throw new BadRequestException(
          'Tracking information is required before marking STANDARD shipping as "In Transit". Please add tracking details first.',
        );
      }

      fulfillment.status = status;
      fulfillment.statusHistory.push({
        status,
        previousStatus,
        reason: reason || `Status updated to ${status}`,
        updatedBy: 'admin',
        createdAt: new Date(),
      });

      // Recalculate order status based on all fulfillments
      guestOrder.status = this.fulfillmentGroupingService.computeOrderStatus(
        guestOrder.fulfillments,
      );

      await guestOrder.save();

      // Send email for major fulfillment status changes (non-blocking)
      const majorFulfillmentStatuses = [
        FulfillmentStatus.IN_TRANSIT,
        FulfillmentStatus.DELIVERED,
        FulfillmentStatus.READY_FOR_PICKUP,
        FulfillmentStatus.CANCELLED,
      ];

      if (majorFulfillmentStatuses.includes(status)) {
        this.sendFulfillmentStatusEmailToGuest(
          guestOrder,
          fulfillmentIndex,
          fulfillment,
          status,
        );
      }

      return { order: guestOrder, isGuestOrder: true };
    }

    throw new NotFoundException('Order not found');
  }

  /**
   * Update fulfillment tracking info (admin only)
   */
  async updateFulfillmentTracking(
    orderId: string,
    fulfillmentIndex: number,
    trackingNumber: string,
    trackingUrl?: string,
    estimatedDeliveryDate?: Date,
    carrier?: string,
  ): Promise<{
    order: OrderDocument | GuestOrderDocument;
    isGuestOrder: boolean;
  }> {
    // Auto-generate tracking URL if carrier is provided and no custom URL given
    let finalTrackingUrl = trackingUrl;
    if (carrier && !trackingUrl && trackingNumber) {
      const generatedUrl = generateCarrierTrackingUrl(
        carrier as ShippingCarrier,
        trackingNumber,
      );
      if (generatedUrl) {
        finalTrackingUrl = generatedUrl;
      }
    }

    // Try regular order first
    const order = await this.orderModel.findOne({ orderId });
    if (order) {
      this.validateFulfillmentIndex(order.fulfillments, fulfillmentIndex);
      const fulfillment = order.fulfillments[fulfillmentIndex];

      if (carrier) fulfillment.carrier = carrier as any;
      fulfillment.trackingNumber = trackingNumber;
      if (finalTrackingUrl) fulfillment.trackingUrl = finalTrackingUrl;
      if (estimatedDeliveryDate)
        fulfillment.estimatedDeliveryDate = estimatedDeliveryDate;

      await order.save();
      return { order, isGuestOrder: false };
    }

    // Try guest order
    const guestOrder = await this.guestOrderModel.findOne({ orderId });
    if (guestOrder) {
      this.validateFulfillmentIndex(guestOrder.fulfillments, fulfillmentIndex);
      const fulfillment = guestOrder.fulfillments[fulfillmentIndex];

      if (carrier) fulfillment.carrier = carrier as any;
      fulfillment.trackingNumber = trackingNumber;
      if (finalTrackingUrl) fulfillment.trackingUrl = finalTrackingUrl;
      if (estimatedDeliveryDate)
        fulfillment.estimatedDeliveryDate = estimatedDeliveryDate;

      await guestOrder.save();
      return { order: guestOrder, isGuestOrder: true };
    }

    throw new NotFoundException('Order not found');
  }

  /**
   * Validates that the fulfillment index is within bounds
   */
  private validateFulfillmentIndex(fulfillments: any[], index: number): void {
    if (!fulfillments || index < 0 || index >= fulfillments.length) {
      throw new BadRequestException(
        `Fulfillment index ${index} does not exist. Order has ${fulfillments?.length || 0} fulfillments.`,
      );
    }
  }

  /**
   * Auto-cancel unpaid pending orders after 24 hours
   * Runs every hour to check for expired orders
   */
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async autoCancelExpiredOrders(): Promise<{
    cancelledCount: number;
    guestCancelledCount: number;
  }> {
    this.logger.log('Running auto-cancellation job for expired unpaid orders');

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let cancelledCount = 0;
    let guestCancelledCount = 0;

    try {
      // Find unpaid pending orders older than 24 hours (registered users)
      const expiredOrders = await this.orderModel.find({
        status: OrderStatus.PENDING,
        isPaid: false,
        createdAt: { $lt: twentyFourHoursAgo },
      });

      this.logger.log(
        `Found ${expiredOrders.length} expired unpaid registered orders`,
      );

      // Cancel each expired order with transaction
      for (const order of expiredOrders) {
        try {
          await inTransaction(this.connection, async (session) => {
            const previousStatus = order.status;
            order.status = OrderStatus.CANCELLED;
            order.cancelledAt = new Date();
            order.cancellationReason =
              'Automatically cancelled - payment not received within 24 hours';
            order.statusHistory.push({
              status: OrderStatus.CANCELLED,
              previousStatus,
              reason:
                'Automatically cancelled - payment not received within 24 hours',
              updatedBy: 'system',
              createdAt: new Date(),
            });
            order.notes.push({
              content:
                'Order automatically cancelled due to non-payment within 24 hours',
              source: 'system',
              visibleToCustomer: true,
              createdAt: new Date(),
            });

            // Restore stock
            await this.restoreStock(order.items, session);
            await order.save({ session });
          });

          cancelledCount++;

          // Send cancellation email
          try {
            await order.populate('userId', 'firstName lastName email');
            const user = order.userId as any;
            if (user && user.email) {
              await this.ordersEmailService.sendCancellationConfirmationEmail(
                user.email,
                order.orderId,
                {
                  customerName: `${user.firstName} ${user.lastName}`,
                  refundAmount: 0,
                  refundTimeline: 'Not applicable',
                  cancellationReason: 'Payment not received within 24 hours',
                  orderTotal: order.totalAmount,
                },
              );
            }
          } catch (emailError) {
            this.logger.error(
              `Failed to send cancellation email for order ${order.orderId}: ${emailError.message}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to cancel order ${order.orderId}: ${error.message}`,
          );
        }
      }

      // Find unpaid pending guest orders older than 24 hours
      const expiredGuestOrders = await this.guestOrderModel.find({
        status: OrderStatus.PENDING,
        isPaid: false,
        createdAt: { $lt: twentyFourHoursAgo },
      });

      this.logger.log(
        `Found ${expiredGuestOrders.length} expired unpaid guest orders`,
      );

      // Cancel each expired guest order with transaction
      for (const guestOrder of expiredGuestOrders) {
        try {
          await inTransaction(this.connection, async (session) => {
            const previousStatus = guestOrder.status;
            guestOrder.status = OrderStatus.CANCELLED;
            guestOrder.cancelledAt = new Date();
            guestOrder.cancellationReason =
              'Automatically cancelled - payment not received within 24 hours';
            guestOrder.statusHistory.push({
              status: OrderStatus.CANCELLED,
              previousStatus,
              reason:
                'Automatically cancelled - payment not received within 24 hours',
              updatedBy: 'system',
              createdAt: new Date(),
            });
            guestOrder.notes.push({
              content:
                'Order automatically cancelled due to non-payment within 24 hours',
              source: 'system',
              visibleToCustomer: true,
              createdAt: new Date(),
            });

            // Restore stock
            await this.restoreStock(guestOrder.items, session);
            await guestOrder.save({ session });
          });

          guestCancelledCount++;

          // Send cancellation email
          try {
            const { email, firstName, lastName } = guestOrder.customerInfo;
            await this.ordersEmailService.sendCancellationConfirmationEmail(
              email,
              guestOrder.orderId,
              {
                customerName: `${firstName} ${lastName}`,
                refundAmount: 0,
                refundTimeline: 'Not applicable',
                cancellationReason: 'Payment not received within 24 hours',
                orderTotal: guestOrder.totalAmount,
              },
            );
          } catch (emailError) {
            this.logger.error(
              `Failed to send cancellation email for guest order ${guestOrder.orderId}: ${emailError.message}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to cancel guest order ${guestOrder.orderId}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Auto-cancellation complete: ${cancelledCount} registered orders, ${guestCancelledCount} guest orders cancelled`,
      );

      return { cancelledCount, guestCancelledCount };
    } catch (error) {
      this.logger.error(
        `Error in auto-cancellation job: ${error.message}`,
        error.stack,
      );
      return { cancelledCount, guestCancelledCount };
    }
  }

  // ============================================================
  // STRIPE CHECKOUT INTEGRATION
  // ============================================================

  /**
   * Calculate Stripe processing fee (2.9% + $0.30 CAD)
   */
  private calculateProcessingFee(orderSubtotal: number): number {
    const fee = orderSubtotal * 0.029 + 0.3;
    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if an order is paid (supports both regular and guest orders)
   */
  async isOrderPaid(orderId: string): Promise<boolean> {
    const regularOrder = await this.orderModel.findOne({ orderId }).lean();
    if (regularOrder) return !!regularOrder.isPaid;

    const guestOrder = await this.guestOrderModel.findOne({ orderId }).lean();
    return !!guestOrder?.isPaid;
  }

  /**
   * Get order by payment intent ID (supports both regular and guest orders)
   */
  async getOrderByPaymentIntent(paymentIntentId: string): Promise<{
    order?: OrderDocument;
    guestOrder?: GuestOrderDocument;
  }> {
    const order = await this.orderModel.findOne({ paymentIntentId });
    if (order) return { order };

    const guestOrder = await this.guestOrderModel.findOne({ paymentIntentId });
    return { guestOrder: guestOrder || undefined };
  }

  /**
   * Mark order as paid (supports both regular and guest orders)
   * Called by Stripe webhook after successful payment
   */
  async markOrderAsPaid(
    orderId: string,
  ): Promise<{ order?: OrderDocument; guestOrder?: GuestOrderDocument }> {
    return inTransaction(this.connection, async (session) => {
      // Try regular order first
      const orderDoc = await this.orderModel
        .findOne({ orderId })
        .session(session);

      if (orderDoc) {
        orderDoc.isPaid = true;
        orderDoc.paidAt = new Date();
        orderDoc.status = OrderStatus.CONFIRMED;
        await orderDoc.save({ session });

        // Send confirmation email
        await orderDoc.populate('userId', 'firstName lastName email');
        const user = orderDoc.userId as any;
        if (user?.email) {
          const details = this.ordersEmailService.prepareOrderConfirmationData(
            orderDoc,
            {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phoneNumber || '',
            },
          );
          await this.ordersEmailService.sendOrderConfirmationEmail(
            user.email,
            orderDoc.orderId,
            details,
            false,
          );
        }

        return { order: orderDoc };
      }

      // Try guest order
      const guestDoc = await this.guestOrderModel
        .findOne({ orderId })
        .session(session);

      if (guestDoc) {
        guestDoc.isPaid = true;
        guestDoc.paidAt = new Date();
        guestDoc.status = OrderStatus.CONFIRMED;
        await guestDoc.save({ session });

        // Send confirmation email
        const details = this.ordersEmailService.prepareOrderConfirmationData(
          guestDoc,
          guestDoc.customerInfo,
        );
        await this.ordersEmailService.sendOrderConfirmationEmail(
          guestDoc.customerInfo.email,
          guestDoc.orderId,
          details,
          true,
        );

        return { guestOrder: guestDoc };
      }

      this.logger.error(`[markOrderAsPaid] Order not found: ${orderId}`);
      throw new NotFoundException('Order not found');
    });
  }

  /**
   * Create Stripe checkout session for registered user order
   */
  async createCheckoutSessionForOrder(
    orderId: string,
    userId: string,
  ): Promise<{ sessionUrl: string }> {
    const appUrl = config.cors.appUrl || 'http://localhost:5173';
    const successUrl = `${appUrl}/payment/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/payment/cancel?orderId=${orderId}`;

    const order = await this.orderModel
      .findOne({
        orderId,
        userId: new Types.ObjectId(userId),
      })
      .populate('userId', 'email');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isPaid) {
      throw new BadRequestException('Order already paid');
    }

    if (order.paymentMethod && order.paymentMethod !== PaymentMethod.STRIPE) {
      this.logger.error(
        `Payment method mismatch! Expected: ${PaymentMethod.STRIPE}, Got: ${order.paymentMethod}`,
      );
      throw new BadRequestException(
        'Payment method must be Stripe for checkout',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order has been cancelled');
    }

    const user = order.userId as any;
    const customerEmail = user?.email;

    // Calculate order subtotal, processing fee, delivery fee, and final amount
    const orderSubtotal = order.items.reduce(
      (sum, i) => sum + i.priceAtPurchase * i.quantity,
      0,
    );
    const deliveryFee = order.deliveryFee || 0;
    const processingFee = this.calculateProcessingFee(
      orderSubtotal + deliveryFee,
    );
    const finalAmount = Math.round(
      (orderSubtotal + deliveryFee + processingFee) * 100,
    ); // Convert to cents

    // Store fee details in order and update totalAmount to include delivery and processing fees
    order.orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    order.deliveryFee = Math.round(deliveryFee * 100) / 100;
    order.processingFee = processingFee;
    order.totalAmount =
      Math.round((orderSubtotal + deliveryFee + processingFee) * 100) / 100;
    await order.save();

    // Create Stripe checkout session
    const session = await this.stripeService.createCheckoutSession({
      amountCents: finalAmount,
      currency: 'cad',
      successUrl,
      cancelUrl,
      customerEmail,
      metadata: {
        orderId: order.orderId,
        userId: order.userId.toString(),
      },
      idempotencyKey: `order_${order.orderId}`,
    });

    // Store session ID and payment intent ID in order
    order.stripeSessionId = session.id;
    order.paymentIntentId = session.payment_intent as string;
    await order.save();

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session URL');
    }

    return { sessionUrl: session.url };
  }

  /**
   * Create Stripe checkout session for guest order
   */
  async createGuestCheckoutSession(
    orderId: string,
    email: string,
  ): Promise<{ sessionUrl: string }> {
    const appUrl = config.cors.appUrl || 'http://localhost:5173';
    const successUrl = `${appUrl}/payment/success?orderId=${orderId}&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/payment/cancel?orderId=${orderId}&email=${encodeURIComponent(email)}`;

    if (!email) {
      throw new BadRequestException('Email is required for guest checkout');
    }

    const order = await this.guestOrderModel.findOne({
      orderId,
      'customerInfo.email': email,
    });

    if (!order) {
      throw new NotFoundException('Guest order not found');
    }

    if (order.isPaid) {
      throw new BadRequestException('Order already paid');
    }

    if (order.paymentMethod && order.paymentMethod !== PaymentMethod.STRIPE) {
      this.logger.error(
        `Payment method mismatch! Expected: ${PaymentMethod.STRIPE}, Got: ${order.paymentMethod}`,
      );
      throw new BadRequestException(
        'Payment method must be Stripe for checkout',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order has been cancelled');
    }

    // Calculate order subtotal, processing fee, delivery fee, and final amount
    const orderSubtotal = order.items.reduce(
      (sum, i) => sum + i.priceAtPurchase * i.quantity,
      0,
    );
    const deliveryFee = order.deliveryFee || 0;
    const processingFee = this.calculateProcessingFee(
      orderSubtotal + deliveryFee,
    );
    const finalAmount = Math.round(
      (orderSubtotal + deliveryFee + processingFee) * 100,
    ); // Convert to cents

    // Store fee details in order and update totalAmount to include delivery and processing fees
    order.orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    order.deliveryFee = Math.round(deliveryFee * 100) / 100;
    order.processingFee = processingFee;
    order.totalAmount =
      Math.round((orderSubtotal + deliveryFee + processingFee) * 100) / 100;
    await order.save();

    // Create Stripe checkout session
    const session = await this.stripeService.createCheckoutSession({
      amountCents: finalAmount,
      currency: 'cad',
      successUrl,
      cancelUrl,
      customerEmail: email,
      metadata: {
        orderId: order.orderId,
        guestEmail: email,
      },
      idempotencyKey: `guest_order_${order.orderId}`,
    });

    // Store session ID and payment intent ID in order
    order.stripeSessionId = session.id;
    order.paymentIntentId = session.payment_intent as string;
    await order.save();

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session URL');
    }

    return { sessionUrl: session.url };
  }
}
