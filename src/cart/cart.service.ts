import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { calculateCartTotal } from './utils/cart-calculator.util';
import { Product, ProductDocument } from '../product/schemas/product.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  /* ---------------- GET OR CREATE ---------------- */

  async getOrCreateCart(userId: string | Types.ObjectId) {
    const objectId = this.toObjectId(userId);

    let cart = await this.cartModel.findOne({ userId: objectId });

    if (!cart) {
      cart = await this.cartModel.create({
        userId: objectId,
        items: [],
        totalAmount: 0,
      });
    }

    return cart;
  }

  /* ---------------- ADD TO CART ---------------- */

  async addToCart(userId: string | Types.ObjectId, dto: AddToCartDto) {
    const cart = await this.getOrCreateCart(userId);

    // 🔴 ALWAYS fetch product from DB
    const product = await this.productModel.findById(dto.productId);
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const existingItem = cart.items.find(
      item => item.productId.toString() === dto.productId,
    );

    if (existingItem) {
      existingItem.quantity += dto.quantity;
      // ❌ DO NOT overwrite priceAtAddedTime
    } else {
      cart.items.push({
        productId: product._id,
        quantity: dto.quantity,
        priceAtAddedTime: product.price, // ✅ snapshot
      } as any);
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId); // ✅ populated response
  }

  /* ---------------- GET CART (POPULATED) ---------------- */

  async getCart(userId: string | Types.ObjectId) {
    const cart = await this.cartModel
      .findOne({ userId: this.toObjectId(userId) })
      .populate({
        path: 'items.productId',
        select: 'name price images stock isActive',
      });

    if (!cart) {
      return { items: [], totalAmount: 0 };
    }

    return cart;
  }

  /* ---------------- REMOVE ITEM ---------------- */

  async removeItem(userId: string | Types.ObjectId, productId: string) {
    const cart = await this.getOrCreateCart(userId);

    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId,
    );

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId);
  }


  async changeQuantity(
    userId: string | Types.ObjectId,
    productId: string,
    delta: number,
  ) {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.items.find(
      i => i.productId.toString() === productId,
    );

    if (!item) {
      throw new NotFoundException('Product not found in cart');
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        i => i.productId.toString() !== productId,
      );
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId);
  }

  async clearCart(userId: string | Types.ObjectId) {
  const cart = await this.getOrCreateCart(userId);

  cart.items = [];
  cart.totalAmount = 0;

  return cart.save();
}

}



