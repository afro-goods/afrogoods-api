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
  token: string;

  @IsString()
  @IsNotEmpty()
  name: string;
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
  orderDetails: Record<string, any>;
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
  statusData: Record<string, any>;
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
