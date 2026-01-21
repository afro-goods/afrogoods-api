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

  private validateCartIdentifier(
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ): void {
    if (!userId && !guestSessionId) {
      throw new BadRequestException(
        'Either userId or guestSessionId must be provided',
      );
    }
    if (userId && guestSessionId) {
      throw new BadRequestException(
        'Cannot provide both userId and guestSessionId',
      );
    }
  }

  private buildCartQuery(
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ) {
    if (userId) {
      return { userId: this.toObjectId(userId) };
    }
    if (guestSessionId) {
      return { guestSessionId };
    }
    throw new BadRequestException(
      'Either userId or guestSessionId must be provided',
    );
  }

  /* ---------------- GET OR CREATE ---------------- */

  async getOrCreateCart(
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ): Promise<CartDocument> {
    this.validateCartIdentifier(userId, guestSessionId);

    const query = this.buildCartQuery(userId, guestSessionId);
    const updateData: any = { $setOnInsert: { items: [], totalAmount: 0 } };

    if (guestSessionId) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      updateData.$setOnInsert.expiresAt = expiresAt;
      updateData.$setOnInsert.guestSessionId = guestSessionId;
    } else if (userId) {
      updateData.$setOnInsert.userId = this.toObjectId(userId);
    }

    const cart = await this.cartModel
      .findOneAndUpdate(query, updateData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .exec();

    return cart;
  }

  async getOrCreateCartForUser(
    userId: string | Types.ObjectId,
  ): Promise<CartDocument> {
    return this.getOrCreateCart(userId);
  }

  async getOrCreateCartForGuest(guestSessionId: string): Promise<CartDocument> {
    return this.getOrCreateCart(undefined, guestSessionId);
  }

  /* ---------------- ADD TO CART ---------------- */

  async addToCart(
    dto: AddToCartDto,
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, guestSessionId);
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
            // Find the selected option and validate it exists
            const selectedOption = attr.options?.find((opt: any) => {
              // Handle both old (string) and new (object) formats
              const optionName = typeof opt === 'string' ? opt : opt.name;
              return optionName === selected;
            });

            if (!selectedOption) {
              throw new BadRequestException(
                `Invalid option selected for ${attr.name}`,
              );
            }

            // Add option price if it's in the new format
            if (typeof selectedOption === 'object' && selectedOption.price) {
              finalPrice += selectedOption.price;
            }
          } else if (attr.type === 'multiple' && Array.isArray(selected)) {
            // Validate that all selected options exist and calculate total price
            for (const sel of selected) {
              const selectedOption = attr.options?.find((opt: any) => {
                // Handle both old (string) and new (object) formats
                const optionName = typeof opt === 'string' ? opt : opt.name;
                return optionName === sel;
              });

              if (!selectedOption) {
                throw new BadRequestException(
                  `Invalid option selected for ${attr.name}`,
                );
              }

              // Add option price if it's in the new format
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

    return this.getCart(userId, guestSessionId);
  }

  async addToCartForUser(userId: string | Types.ObjectId, dto: AddToCartDto) {
    return this.addToCart(dto, userId);
  }

  async addToCartForGuest(guestSessionId: string, dto: AddToCartDto) {
    return this.addToCart(dto, undefined, guestSessionId);
  }

  /* ---------------- GET CART (POPULATED) ---------------- */

  async getCart(userId?: string | Types.ObjectId, guestSessionId?: string) {
    this.validateCartIdentifier(userId, guestSessionId);

    const query = this.buildCartQuery(userId, guestSessionId);

    const cart = await this.cartModel
      .findOne(query)
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
        })),
      totalAmount: cart.totalAmount,
    };
  }

  async getCartForUser(userId: string | Types.ObjectId) {
    return this.getCart(userId);
  }

  async getCartForGuest(guestSessionId: string) {
    return this.getCart(undefined, guestSessionId);
  }

  /* ---------------- REMOVE ITEM ---------------- */

  async removeItem(
    productId: string,
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, guestSessionId);

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );

    cart.totalAmount = calculateCartTotal(cart.items);
    await cart.save();

    return this.getCart(userId, guestSessionId);
  }

  async changeQuantity(
    productId: string,
    delta: number,
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, guestSessionId);

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

    return this.getCart(userId, guestSessionId);
  }

  async clearCart(userId?: string | Types.ObjectId, guestSessionId?: string) {
    const cart = await this.getOrCreateCart(userId, guestSessionId);

    cart.items = [];
    cart.totalAmount = 0;

    return cart.save();
  }

  async removeItemForUser(userId: string | Types.ObjectId, productId: string) {
    return this.removeItem(productId, userId);
  }

  async removeItemForGuest(guestSessionId: string, productId: string) {
    return this.removeItem(productId, undefined, guestSessionId);
  }

  async changeQuantityForUser(
    userId: string | Types.ObjectId,
    productId: string,
    delta: number,
  ) {
    return this.changeQuantity(productId, delta, userId);
  }

  async changeQuantityForGuest(
    guestSessionId: string,
    productId: string,
    delta: number,
  ) {
    return this.changeQuantity(productId, delta, undefined, guestSessionId);
  }

  async clearCartForUser(userId: string | Types.ObjectId) {
    return this.clearCart(userId);
  }

  async clearCartForGuest(guestSessionId: string) {
    return this.clearCart(undefined, guestSessionId);
  }

  async replaceCart(
    localItems: CartItemInput[],
    userId?: string | Types.ObjectId,
    guestSessionId?: string,
  ) {
    this.validateCartIdentifier(userId, guestSessionId);

    const productIds = localItems.map((i) => i.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds }, isActive: true })
      .populate('attributes')
      .select('_id price attributes')
      .lean();

    const validProductMap = new Map(products.map((p) => [p._id.toString(), p]));

    const query = this.buildCartQuery(userId, guestSessionId);
    const existingCart = await this.cartModel.findOne(query).lean();

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

    const updateData: any = {
      $set: {
        items: mergedItems,
        totalAmount,
      },
    };

    if (guestSessionId) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      updateData.$set.expiresAt = expiresAt;
    }

    await this.cartModel.findOneAndUpdate(query, updateData, { upsert: true });

    return this.getCart(userId, guestSessionId);
  }

  async replaceCartForUser(
    userId: string | Types.ObjectId,
    localItems: CartItemInput[],
  ) {
    return this.replaceCart(localItems, userId);
  }

  async replaceCartForGuest(
    guestSessionId: string,
    localItems: CartItemInput[],
  ) {
    return this.replaceCart(localItems, undefined, guestSessionId);
  }

  /* ---------------- CART EXPIRATION HANDLING ---------------- */

  async cleanupExpiredGuestCarts(): Promise<void> {
    const now = new Date();
    await this.cartModel.deleteMany({
      guestSessionId: { $exists: true },
      expiresAt: { $lt: now },
    });
  }

  async extendGuestCartExpiration(guestSessionId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.cartModel.updateOne({ guestSessionId }, { $set: { expiresAt } });
  }
}
