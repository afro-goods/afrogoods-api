import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus } from '../enums/order-status.enum';
import { FulfillmentStatus } from '../enums/fulfillment-status.enum';
import { FulfillmentType } from '../enums/fulfillment-type.enum';
import { ShippingCarrier } from '../enums/shipping-carrier.enum';

export class AdminOrderSearchDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  guestOrdersOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  registeredOrdersOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;
}

// Fulfillment status history entry
export interface FulfillmentStatusHistoryDto {
  status: FulfillmentStatus;
  previousStatus?: FulfillmentStatus;
  reason?: string;
  updatedBy: string;
  createdAt: Date;
}

// Fulfillment DTO for admin response
export interface FulfillmentDto {
  type: FulfillmentType;
  status: FulfillmentStatus;
  itemIndices: number[];
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: Date;
  statusHistory: FulfillmentStatusHistoryDto[];
}

// Order note DTO
export interface OrderNoteDto {
  content: string;
  source: 'admin' | 'customer' | 'system';
  authorId?: string;
  visibleToCustomer: boolean;
  createdAt: Date;
}

// Order status history DTO
export interface OrderStatusHistoryDto {
  status: OrderStatus;
  previousStatus?: OrderStatus;
  reason: string;
  updatedBy: string;
  createdAt: Date;
}

export class AdminOrderResponseDto {
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  isPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
  isGuestOrder: boolean;

  customer: {
    id?: string; // Only for registered users
    name: string;
    email: string;
    phone?: string;
  };

  itemsCount: number;
  items: Array<{
    productId: string;
    productName?: string;
    productImage?: string;
    quantity: number;
    priceAtPurchase: number;
    deliveryTimeUnit?: string;
    deliveryMinTime?: number;
    deliveryMaxTime?: number;
  }>;

  // Fulfillment groups
  fulfillments?: FulfillmentDto[];

  // Shipping information
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  // Notes and history
  notes?: OrderNoteDto[];
  statusHistory?: OrderStatusHistoryDto[];
}

export class AdminOrderListResponseDto {
  orders: AdminOrderResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
