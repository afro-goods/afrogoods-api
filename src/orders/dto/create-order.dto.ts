import { IsOptional, ValidateNested, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from './update-shipping-address.dto';
import { PaymentMethod } from '../enums/payment-method.enum';

/**
 * DTO for creating an order from cart for registered users
 * Cart items are already stored in the backend, so we only need address information
 */
export class CreateOrderDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;
}
