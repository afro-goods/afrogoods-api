import { CartItem } from '../schemas/cart-item.schema';

/**
 * Calculates the total amount of the cart.
 * Ensures missing prices default to 0.
 */
export const calculateCartTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => {
    const price = item.priceAtAddedTime ?? 0; 
    const quantity = item.quantity ?? 0;      
    return sum + price * quantity;
  }, 0);
};
