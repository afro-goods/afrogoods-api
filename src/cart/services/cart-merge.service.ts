import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from '../schemas/cart.schema';
import { CartItem } from '../schemas/cart-item.schema';
import { Product, ProductDocument } from '../../product/schemas/product.schema';
import { CartMergeStrategy } from '../enums/cart-merge-strategy.enum';
import {
  CartMergeResult,
  CartMergeConflict,
  CartMergeOptions,
} from '../interfaces/cart-merge.interface';
import { calculateCartTotal } from '../utils/cart-calculator.util';

@Injectable()
export class CartMergeService {
  private readonly logger = new Logger(CartMergeService.name);

  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  /**
   * Merge guest cart with user cart on login
   */
  async mergeGuestCart(
    userId: string | Types.ObjectId,
    guestSessionId: string,
    options: CartMergeOptions = { strategy: CartMergeStrategy.MERGE_COMBINE },
  ): Promise<CartMergeResult> {
    this.logger.log(
      `Starting cart merge for user ${userId.toString()} and guest session ${guestSessionId}`,
    );

    const userObjectId = this.toObjectId(userId);

    // Get both carts
    const [guestCart, userCart] = await Promise.all([
      this.cartModel.findOne({ guestSessionId }).lean(),
      this.cartModel.findOne({ userId: userObjectId }).lean(),
    ]);

    if (!guestCart || !guestCart.items.length) {
      this.logger.log('No guest cart found or guest cart is empty');
      return {
        mergedCart: userCart
          ? { items: userCart.items, totalAmount: userCart.totalAmount }
          : { items: [], totalAmount: 0 },
        duplicatesFound: false,
        duplicateItems: [],
        strategy: options.strategy,
      };
    }

    // If no user cart exists, convert guest cart to user cart
    if (!userCart || !userCart.items.length) {
      this.logger.log('No user cart found, converting guest cart to user cart');
      return this.convertGuestCartToUserCart(
        userObjectId,
        guestCart,
        guestSessionId,
      );
    }

    // Both carts exist, perform merge based on strategy
    return this.performCartMerge(
      userObjectId,
      guestCart,
      userCart,
      guestSessionId,
      options,
    );
  }

  /**
   * Detect duplicate items between guest and user carts
   */
  async detectDuplicates(
    guestCart: any,
    userCart: any,
  ): Promise<CartMergeConflict[]> {
    const conflicts: CartMergeConflict[] = [];
    const userItemMap = new Map<string, CartItem>();

    // Create a map of user cart items for quick lookup
    userCart.items.forEach((item: CartItem) => {
      const key = this.generateItemKey(item);
      userItemMap.set(key, item);
    });

    // Check for duplicates in guest cart
    for (const guestItem of guestCart.items) {
      const key = this.generateItemKey(guestItem);
      const userItem = userItemMap.get(key);

      if (userItem) {
        // Get product name for better conflict description
        const product = await this.productModel
          .findById(guestItem.productId)
          .select('name')
          .lean();

        conflicts.push({
          productId: guestItem.productId.toString(),
          guestQuantity: guestItem.quantity,
          userQuantity: userItem.quantity,
          productName: product?.name,
          priceAtAddedTime: guestItem.priceAtAddedTime,
          selectedAttributes: guestItem.selectedAttributes,
        });
      }
    }

    return conflicts;
  }

  /**
   * Combine quantities for duplicate items
   */
  combineQuantities(
    guestItems: CartItem[],
    userItems: CartItem[],
    options: CartMergeOptions,
  ): CartItem[] {
    const mergedItemsMap = new Map<string, CartItem>();

    // Add all user items first
    userItems.forEach((item) => {
      const key = this.generateItemKey(item);
      mergedItemsMap.set(key, { ...item });
    });

    // Process guest items
    for (const guestItem of guestItems) {
      const key = this.generateItemKey(guestItem);
      const existingItem = mergedItemsMap.get(key);

      if (existingItem) {
        // Combine quantities
        const combinedQuantity = existingItem.quantity + guestItem.quantity;

        // Check max quantity limit if specified
        if (
          options.maxQuantityPerItem &&
          combinedQuantity > options.maxQuantityPerItem
        ) {
          this.logger.warn(
            `Combined quantity ${combinedQuantity} exceeds limit ${options.maxQuantityPerItem} for product ${guestItem.productId.toString()}`,
          );
          existingItem.quantity = options.maxQuantityPerItem;
        } else {
          existingItem.quantity = combinedQuantity;
        }

        // Optionally preserve guest prices if they're more recent
        if (options.preserveGuestPrices) {
          existingItem.priceAtAddedTime = guestItem.priceAtAddedTime;
        }
      } else {
        // Add new item from guest cart
        mergedItemsMap.set(key, { ...guestItem });
      }
    }

    return Array.from(mergedItemsMap.values());
  }

  /**
   * Validate stock availability for merged cart items
   */
  async validateMergedCartStock(items: CartItem[]): Promise<void> {
    const productIds = items.map((item) => item.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .select('_id stock')
      .lean();

    const productStockMap = new Map(
      products.map((p) => [p._id.toString(), p.stock]),
    );

    for (const item of items) {
      const availableStock = productStockMap.get(item.productId.toString());
      if (availableStock === undefined) {
        throw new NotFoundException(
          `Product ${item.productId.toString()} not found during stock validation`,
        );
      }

      if (item.quantity > availableStock) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId.toString()}. Requested: ${item.quantity}, Available: ${availableStock}`,
        );
      }
    }
  }

  /**
   * Clean up guest cart data after successful merge
   */
  async cleanupGuestData(guestSessionId: string): Promise<void> {
    try {
      await this.cartModel.deleteOne({ guestSessionId });
      this.logger.log(`Cleaned up guest cart for session ${guestSessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to cleanup guest cart for session ${guestSessionId}:`,
        error,
      );
      // Don't throw error as merge was successful
    }
  }

  private async convertGuestCartToUserCart(
    userId: Types.ObjectId,
    guestCart: any,
    guestSessionId: string,
  ): Promise<CartMergeResult> {
    // Create or update user cart with guest cart items
    await this.cartModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          items: guestCart.items,
          totalAmount: guestCart.totalAmount,
        },
        $unset: { expiresAt: 1 }, // Remove expiration for user cart
      },
      { upsert: true, new: true },
    );

    // Clean up guest cart
    await this.cleanupGuestData(guestSessionId);

    this.logger.log(
      `Converted guest cart to user cart for user ${userId.toString()}`,
    );

    return {
      mergedCart: {
        items: guestCart.items,
        totalAmount: guestCart.totalAmount,
      },
      duplicatesFound: false,
      duplicateItems: [],
      strategy: CartMergeStrategy.REPLACE_USER,
    };
  }

  private async performCartMerge(
    userId: Types.ObjectId,
    guestCart: any,
    userCart: any,
    guestSessionId: string,
    options: CartMergeOptions,
  ): Promise<CartMergeResult> {
    let mergedItems: CartItem[];
    let duplicatesFound = false;
    let duplicateItems: CartItem[] = [];

    // Detect duplicates first
    const conflicts = await this.detectDuplicates(guestCart, userCart);
    duplicatesFound = conflicts.length > 0;

    if (duplicatesFound) {
      duplicateItems = conflicts.map((conflict) => ({
        productId: new Types.ObjectId(conflict.productId),
        quantity: conflict.guestQuantity + conflict.userQuantity,
        priceAtAddedTime: conflict.priceAtAddedTime,
        selectedAttributes: conflict.selectedAttributes,
      })) as CartItem[];
    }

    // Apply merge strategy
    switch (options.strategy) {
      case CartMergeStrategy.REPLACE_GUEST:
        mergedItems = [...userCart.items];
        break;

      case CartMergeStrategy.REPLACE_USER:
        mergedItems = [...guestCart.items];
        break;

      case CartMergeStrategy.MERGE_COMBINE:
        mergedItems = this.combineQuantities(
          guestCart.items,
          userCart.items,
          options,
        );
        break;

      default:
        throw new BadRequestException(
          `Unsupported merge strategy: ${options.strategy}`,
        );
    }

    // Validate stock if required
    if (options.validateStock) {
      await this.validateMergedCartStock(mergedItems);
    }

    // Calculate total amount
    const totalAmount = calculateCartTotal(mergedItems);

    // Update user cart
    await this.cartModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          items: mergedItems,
          totalAmount,
        },
        $unset: { expiresAt: 1 }, // Remove expiration for user cart
      },
      { new: true },
    );

    // Clean up guest cart
    await this.cleanupGuestData(guestSessionId);

    this.logger.log(
      `Successfully merged carts for user ${userId.toString()} using strategy ${options.strategy}`,
    );

    return {
      mergedCart: {
        items: mergedItems,
        totalAmount,
      },
      duplicatesFound,
      duplicateItems,
      strategy: options.strategy,
    };
  }

  private generateItemKey(item: CartItem): string {
    // Create a unique key for cart items based on product ID and selected attributes
    const attributesKey = item.selectedAttributes
      ? JSON.stringify(item.selectedAttributes)
      : '';
    return `${item.productId.toString()}_${attributesKey}`;
  }

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }
}
