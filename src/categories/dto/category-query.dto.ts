import { IsOptional, IsEnum } from 'class-validator';
import { CategoryType } from '../enums/category-type.enum';

export class CategoryQueryDto {
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;
}
