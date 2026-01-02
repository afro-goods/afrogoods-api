import { IsMongoId } from 'class-validator';

export class RemoveCartItemDto {
  @IsMongoId()
  productId: string;
}