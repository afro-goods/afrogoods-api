import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { calculateCartTotal } from './utils/cart-calculator.util';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
  ) {}

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  async getOrCreateCart(userId: string | Types.ObjectId) {
    const objectId = this.toObjectId(userId);
    let cart = await this.cartModel.findOne({ userId: objectId });
    if (!cart) {
      cart = await this.cartModel.create({ userId: objectId, items: [], totalAmount: 0 });
    }
    return cart;
  }

  async addToCart(userId: string | Types.ObjectId, dto: AddToCartDto) {
    const cart = await this.getOrCreateCart(userId);

    // Use optional price if provided, otherwise fallback to placeholder
    const price = dto.price ?? 100;

    const existingItem = cart.items.find(
      i => i.productId.toString() === dto.productId,
    );

    if (existingItem) {
      existingItem.quantity += dto.quantity;
      existingItem.priceAtAddedTime = price; // optionally update price
    } else {
      cart.items.push({
        productId: this.toObjectId(dto.productId),
        quantity: dto.quantity,
        priceAtAddedTime: price,
      } as any);
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    return cart.save();
  }

  async getCart(userId: string | Types.ObjectId) {
    const cart = await this.cartModel.findOne({ userId: this.toObjectId(userId) });
    if (!cart) {
      return { items: [], totalAmount: 0 };
    }
    return cart;
  }

  async removeItem(userId: string | Types.ObjectId, productId: string) {
    const cart = await this.getOrCreateCart(userId);

    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId,
    );

    cart.totalAmount = calculateCartTotal(cart.items);
    return cart.save();
  }

  /** Increase or decrease cart item quantity */
  async changeQuantity(userId: string | Types.ObjectId, productId: string, delta: number) {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.items.find(i => i.productId.toString() === productId);
    if (!item) {
      throw new NotFoundException('Product not found in cart');
    }

    item.quantity += delta;

    // Remove if quantity drops below 1
    if (item.quantity <= 0) {
      cart.items = cart.items.filter(i => i.productId.toString() !== productId);
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    return cart.save();
  }
}
