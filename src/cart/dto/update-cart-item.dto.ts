import { IsMongoId, IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsMongoId()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}