import {
  IsMongoId,
  IsNumber,
  Min,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CartItemInput {
  @IsMongoId()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  priceAtAddedTime: number;

  @IsOptional()
  @IsObject()
  selectedAttributes?: Record<string, any>;
}
