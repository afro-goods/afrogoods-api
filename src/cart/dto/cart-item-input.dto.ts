import { IsMongoId, IsNumber, Min } from 'class-validator';

export class CartItemInput {
  @IsMongoId()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  priceAtAddedTime: number;

  selectedAttributes?: Record<string, any>;
}
