// src/orders/dto/create-order.dto.ts
import { IsMongoId } from 'class-validator';

export class CreateOrderDto {
  @IsMongoId()
  cartId: string;
}
