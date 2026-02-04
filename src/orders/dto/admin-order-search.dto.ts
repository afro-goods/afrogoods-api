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
    quantity: number;
    priceAtPurchase: number;
  }>;

  // Shipping information (only for guest orders)
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
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
