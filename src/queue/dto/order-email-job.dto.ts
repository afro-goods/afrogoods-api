import { IsEmail, IsString, IsNotEmpty, IsObject } from 'class-validator';

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
