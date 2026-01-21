import type { CartItem } from '../schemas/cart-item.schema';
import type { CartMergeStrategy } from '../enums/cart-merge-strategy.enum';

export interface CartMergeResult {
  mergedCart: {
    items: CartItem[];
    totalAmount: number;
  };
  duplicatesFound: boolean;
  duplicateItems: CartItem[];
  strategy: CartMergeStrategy;
}

export interface CartMergeConflict {
  productId: string;
  guestQuantity: number;
  userQuantity: number;
  productName?: string;
  priceAtAddedTime: number;
  selectedAttributes?: Record<string, any>;
}

export interface CartMergeOptions {
  strategy: CartMergeStrategy;
  maxQuantityPerItem?: number;
  preserveGuestPrices?: boolean;
  validateStock?: boolean;
}
