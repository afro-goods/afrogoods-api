import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';

// Base email job DTO
export class EmailJobDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

// Welcome email DTO
export class SendWelcomeEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

// Password reset email DTO
export class SendPasswordResetEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  token: string; // This is a complete Firebase password reset URL from generatePasswordResetLink()

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  expiryMinutes?: number;
}

// Verification email DTO
export class SendVerificationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

// Order confirmation email DTO
export class SendOrderConfirmationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsObject()
  @IsNotEmpty()
  orderDetails: {
    customerName: string;
    totalAmount: number;
    itemCount: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      variant?: string;
    }>;
    shippingCost: number;
    shippingAddress: {
      name: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      phone?: string;
    };
    paymentMethod: string;
    orderDate?: Date;
    currency?: string;
    subtotal?: number;
    discount?: number;
    discountCode?: string;
    tax?: number;
    total?: number;
    estimatedDelivery?: string;
    paymentDetails?: string;
    specialInstructions?: string;
  };
}

// Order status update email DTO
export class SendOrderStatusUpdateEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsObject()
  @IsNotEmpty()
  statusData: {
    customerName: string;
    previousStatus: string;
    newStatus: string;
    updateDate?: Date;
    estimatedDelivery?: string;
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
    deliveryDate?: Date;
    refundInfo?: string;
    adminMessage?: string;
    fulfillmentLabel?: string; // e.g., "Shipment 1 of 2" or "Your order"
  };
}

// Admin communication email DTO
export class SendAdminCommunicationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}

// Order cancellation email DTO
export class SendCancellationConfirmationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsObject()
  @IsNotEmpty()
  cancellationData: {
    customerName: string;
    refundAmount: number;
    refundTimeline: string;
    cancellationReason: string;
    orderTotal: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
    refundMethod?: string;
  };
}

export class SendAdvertSubmittedEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  advertTitle: string;

  @IsString()
  @IsNotEmpty()
  advertType: string;
}

export class SendAdvertReviewedEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  advertTitle: string;

  @IsString()
  @IsNotEmpty()
  status: string; // 'approved' | 'rejected'

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
