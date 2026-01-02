import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Order, OrderDocument, OrderStatus } from './schemas/orders.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { generateOrderId } from '../utilities/generateId/orderId';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,

    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  // CREATE ORDER
  async create(userId: string) {
    const cart = await this.cartModel.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 1️⃣ Normalize productIds
    const productIds = cart.items
      .map((item) => {
        if (!Types.ObjectId.isValid(item.productId as any)) return null;
        return new Types.ObjectId(item.productId);
      })
      .filter(Boolean) as Types.ObjectId[];

    if (!productIds.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    // 2️⃣ Fetch active products
    const products = await this.productModel
      .find({
        _id: { $in: productIds },
        isActive: true,
      })
      .select('_id')
      .lean();

    if (!products.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    const validProductIds = new Set(
      products.map((p) => p._id.toString()),
    );

    // 3️⃣ Filter valid cart items
    const validItems = cart.items.filter((item) =>
      validProductIds.has(item.productId.toString()),
    );

    if (!validItems.length) {
      throw new BadRequestException(
        'All products in your cart are no longer available',
      );
    }

    // 4️⃣ Create order
    const order = await this.orderModel.create({
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
    });

    // 5️⃣ Clear cart
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    return order;
  }

  // CUSTOMER: MY ORDERS
  async findMyOrders(userId: string) {
    return this.orderModel.find({ userId }).sort({ createdAt: -1 });
  }

  // CUSTOMER: SINGLE ORDER
  async findOne(orderId: string, userId: string) {
    const order = await this.orderModel.findOne({ orderId, userId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // CUSTOMER: CANCEL ORDER
  async cancelByUser(orderId: string, userId: string) {
    const order = await this.findOne(orderId, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    order.status = OrderStatus.CANCELLED;
    return order.save();
  }

  // MOCK PAYMENT
  async mockPay(orderId: string, userId: string) {
    const order = await this.findOne(orderId, userId);

    if (order.isPaid) {
      throw new BadRequestException('Order already paid');
    }

    order.isPaid = true;
    order.status = OrderStatus.PAID;

    return order.save();
  }

  // ADMIN
  async findAll() {
    return this.orderModel.find().sort({ createdAt: -1 });
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.orderModel.findOne({ orderId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = status;
    return order.save();
  }
}
