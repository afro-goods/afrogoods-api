import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

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

export class SendWelcomeEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

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

export class EmailPriorityDto {
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number;
}
