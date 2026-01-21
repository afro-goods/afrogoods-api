import type { OrderStatus } from '../enums/order-status.enum';

/**
 * Note structure embedded in orders
 * Used by both Order and GuestOrder schemas
 */
export interface Note {
  content: string;
  source: 'customer' | 'admin' | 'system';
  authorId?: string;
  visibleToCustomer: boolean;
  createdAt: Date;
}

/**
 * Status history structure embedded in orders
 * Used by both Order and GuestOrder schemas
 */
export interface StatusHistory {
  status: OrderStatus;
  previousStatus?: OrderStatus;
  reason?: string;
  updatedBy: string;
  createdAt: Date;
}

/**
 * Address structure used for shipping and billing
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  apartment?: string;
  instructions?: string;
}
