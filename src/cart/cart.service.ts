import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { calculateCartTotal } from './utils/cart-calculator.util';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { CartItemInput } from './dto/cart-item-input.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) { }

  private toObjectId(id: string | Types.ObjectId | undefined): Types.ObjectId {
    if (!id) {
      throw new BadRequestException('Invalid user ID');
    }
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  /* ---------------- GET OR CREATE ---------------- */

  async getOrCreateCart(
    userId: string | Types.ObjectId,
  ): Promise<CartDocument> {
    const objectId = this.toObjectId(userId);

    const cart = await this.cartModel
      .findOneAndUpdate(
        { userId: objectId },
        { $setOnInsert: { items: [], totalAmount: 0 } },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return cart;
  }

  /* ---------------- ADD TO CART ---------------- */

  async addToCart(userId: string | Types.ObjectId, dto: AddToCartDto) {
    const cart = await this.getOrCreateCart(userId);

    const product = await this.productModel.findById(dto.productId).lean();
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === dto.productId,
    );

    if (existingItem) {
      if (existingItem.quantity + dto.quantity > product.stock) {
        throw new BadRequestException('Not enough stock');
      }
      existingItem.quantity += dto.quantity;
    } else {
      if (dto.quantity > product.stock) {
        throw new BadRequestException('Not enough stock');
      }
      cart.items.push({
        productId: product._id,
        quantity: dto.quantity,
        priceAtAddedTime: product.price,
      } as any);
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId);
  }

  /* ---------------- GET CART (POPULATED) ---------------- */

  async getCart(userId: string | Types.ObjectId) {
    const cart = await this.cartModel
      .findOne({ userId: this.toObjectId(userId) })
      .populate({
        path: 'items.productId',
        select: 'name price description images stock isActive',
      })
      .lean()
      .exec();

    if (!cart || cart.items.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    return {
      items: cart.items.map((item: any) => ({
        productId: item.productId._id.toString(),
        name: item.productId.name,
        price: item.productId.price,
        images: item.productId.images?.[0] || null,
        stock: item.productId.stock,
        quantity: item.quantity,
        priceAtAddedTime: item.priceAtAddedTime,
      })),
      totalAmount: cart.totalAmount,
    };
  }

  /* ---------------- REMOVE ITEM ---------------- */

  async removeItem(userId: string | Types.ObjectId, productId: string) {
    const cart = await this.getOrCreateCart(userId);

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
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

    const item = cart.items.find((i) => i.productId.toString() === productId);

    if (!item) {
      throw new NotFoundException('Product not found in cart');
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => i.productId.toString() !== productId,
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

  async replaceCart(
    userId: string | Types.ObjectId,
    localItems: CartItemInput[],
  ) {
    const objectId = this.toObjectId(userId);

    const productIds = localItems.map((i) => i.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds }, isActive: true })
      .select('_id price')
      .lean();

    const validProductMap = new Map(
      products.map((p) => [p._id.toString(), p.price]),
    );

    const existingCart = await this.cartModel
      .findOne({ userId: objectId })
      .lean();

    const mergedItemsMap = new Map<string, any>();

    (existingCart?.items || []).forEach((item) => {
      mergedItemsMap.set(item.productId.toString(), {
        productId: item.productId,
        quantity: item.quantity,
        priceAtAddedTime: item.priceAtAddedTime,
      });
    });

    localItems.forEach((localItem) => {
      const price = validProductMap.get(localItem.productId);
      if (!price) return;

      const existing = mergedItemsMap.get(localItem.productId);
      if (existing) {
        existing.quantity += localItem.quantity;
      } else {
        mergedItemsMap.set(localItem.productId, {
          productId: new Types.ObjectId(localItem.productId),
          quantity: localItem.quantity,
          priceAtAddedTime: price,
        });
      }
    });

    const mergedItems = Array.from(mergedItemsMap.values());

    const totalAmount = mergedItems.reduce(
      (sum, item) => sum + item.priceAtAddedTime * item.quantity,
      0,
    );

    await this.cartModel.findOneAndUpdate(
      { userId: objectId },
      {
        $set: {
          items: mergedItems,
          totalAmount,
        },
      },
      { upsert: true },
    );

    return this.getCart(objectId);
  }
}