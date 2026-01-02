// src/orders/dto/update-status.dto.ts
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(['Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
  status: string;
}
