import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from './update-shipping-address.dto';

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
}
