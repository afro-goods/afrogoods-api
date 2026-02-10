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
import { AvailabilityStatus } from '../product/enums/availabilty-status.enum';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

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
    const userObjectId = this.toObjectId(userId);

    const cart = await this.cartModel
      .findOneAndUpdate(
        { userId: userObjectId },
        { $setOnInsert: { items: [], totalAmount: 0, userId: userObjectId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return cart;
  }

  /* ---------------- ADD TO CART ---------------- */

  async addToCart(dto: AddToCartDto, userId: string | Types.ObjectId) {
    const cart = await this.getOrCreateCart(userId);
    const product = await this.productModel
      .findById(dto.productId)
      .populate('attributes')
      .lean();

    if (
      !product ||
      product.availabilityStatus !== AvailabilityStatus.IN_STOCK
    ) {
      throw new NotFoundException('Product not found');
    }

    // Calculate price based on selected attributes/options
    let finalPrice = product.price;
    if (dto.selectedAttributes && product.attributes) {
      for (const attr of product.attributes as any[]) {
        const selected = dto.selectedAttributes[attr.name];
        if (selected) {
          if (attr.type === 'single') {
            const selectedOption = attr.options?.find((opt: any) => {
              const optionName = typeof opt === 'string' ? opt : opt.name;
              return optionName === selected;
            });

            if (!selectedOption) {
              throw new BadRequestException(
                `Invalid option selected for ${attr.name}`,
              );
            }

            if (typeof selectedOption === 'object' && selectedOption.price) {
              finalPrice += selectedOption.price;
            }
          } else if (attr.type === 'multiple' && Array.isArray(selected)) {
            for (const sel of selected) {
              const selectedOption = attr.options?.find((opt: any) => {
                const optionName = typeof opt === 'string' ? opt : opt.name;
                return optionName === sel;
              });

              if (!selectedOption) {
                throw new BadRequestException(
                  `Invalid option selected for ${attr.name}`,
                );
              }

              if (typeof selectedOption === 'object' && selectedOption.price) {
                finalPrice += selectedOption.price;
              }
            }
          }
        }
      }
    }

    const findKey = (item: any) => {
      if (item.productId.toString() !== dto.productId) return false;
      return (
        JSON.stringify(item.selectedAttributes || {}) ===
        JSON.stringify(dto.selectedAttributes || {})
      );
    };
    const existingItem = cart.items.find(findKey);

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
        priceAtAddedTime: finalPrice,
        selectedAttributes: dto.selectedAttributes || {},
      } as any);
    }

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId);
  }

  /* ---------------- GET CART (POPULATED) ---------------- */

  async getCart(userId: string | Types.ObjectId) {
    const userObjectId = this.toObjectId(userId);

    const cart = await this.cartModel
      .findOne({ userId: userObjectId })
      .populate({
        path: 'items.productId',
        select:
          'name price description images stock isActive deliveryTimeUnit deliveryMinTime deliveryMaxTime',
      })
      .lean()
      .exec();

    if (!cart || cart.items.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    return {
      items: cart.items
        .filter((item: any) => item.productId !== null)
        .map((item: any) => ({
          productId: item.productId._id.toString(),
          name: item.productId.name,
          price: item.productId.price,
          images: item.productId.images?.[0] || null,
          stock: item.productId.stock,
          quantity: item.quantity,
          priceAtAddedTime: item.priceAtAddedTime,
          selectedAttributes: item.selectedAttributes || {},
          deliveryTimeUnit: item.productId.deliveryTimeUnit,
          deliveryMinTime: item.productId.deliveryMinTime,
          deliveryMaxTime: item.productId.deliveryMaxTime,
        })),
      totalAmount: cart.totalAmount,
    };
  }

  /* ---------------- REMOVE ITEM ---------------- */

  async removeItem(productId: string, userId: string | Types.ObjectId) {
    const cart = await this.getOrCreateCart(userId);

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId);
  }

  async changeQuantity(
    productId: string,
    delta: number,
    userId: string | Types.ObjectId,
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
    localItems: CartItemInput[],
    userId: string | Types.ObjectId,
  ) {
    const userObjectId = this.toObjectId(userId);

    const productIds = localItems.map((i) => i.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds }, isActive: true })
      .populate('attributes')
      .select('_id price attributes')
      .lean();

    const validProductMap = new Map(products.map((p) => [p._id.toString(), p]));

    const existingCart = await this.cartModel
      .findOne({ userId: userObjectId })
      .lean();

    const mergedItemsMap = new Map<string, any>();

    (existingCart?.items || []).forEach((item) => {
      mergedItemsMap.set(item.productId.toString(), {
        productId: item.productId,
        quantity: item.quantity,
        priceAtAddedTime: item.priceAtAddedTime,
        selectedAttributes: item.selectedAttributes || {},
      });
    });

    localItems.forEach((localItem) => {
      const product = validProductMap.get(localItem.productId);
      if (!product) return;

      let finalPrice = product.price;
      if (localItem.selectedAttributes && product.attributes) {
        for (const attr of product.attributes as any[]) {
          const selected = localItem.selectedAttributes[attr.name];
          if (selected) {
            if (attr.type === 'single') {
              const selectedOption = attr.options?.find((opt: any) => {
                const optionName = typeof opt === 'string' ? opt : opt.name;
                return optionName === selected;
              });
              if (typeof selectedOption === 'object' && selectedOption.price) {
                finalPrice += selectedOption.price;
              }
            } else if (attr.type === 'multiple' && Array.isArray(selected)) {
              for (const sel of selected) {
                const selectedOption = attr.options?.find((opt: any) => {
                  const optionName = typeof opt === 'string' ? opt : opt.name;
                  return optionName === sel;
                });
                if (
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

      const existing = mergedItemsMap.get(localItem.productId);
      if (existing) {
        existing.quantity += localItem.quantity;
      } else {
        mergedItemsMap.set(localItem.productId, {
          productId: new Types.ObjectId(localItem.productId),
          quantity: localItem.quantity,
          priceAtAddedTime: finalPrice,
          selectedAttributes: localItem.selectedAttributes || {},
        });
      }
    });

    const mergedItems = Array.from(mergedItemsMap.values());

    const totalAmount = mergedItems.reduce(
      (sum, item) => sum + item.priceAtAddedTime * item.quantity,
      0,
    );

    await this.cartModel.findOneAndUpdate(
      { userId: userObjectId },
      { $set: { items: mergedItems, totalAmount } },
      { upsert: true },
    );

    return this.getCart(userId);
  }
}
