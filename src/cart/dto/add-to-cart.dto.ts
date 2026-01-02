import { IsMongoId, IsInt, Min, IsOptional, IsNumber } from 'class-validator';

export class AddToCartDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ID' })
  productId: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @IsOptional()
  @IsNumber({}, { message: 'price must be a number' })
  price?: number; // optional field for testing
}