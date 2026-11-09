import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoryType } from '../enums/category-type.enum';

export class CategoryQueryDto {
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  // Filter to return only parent categories (no subcategories)
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  parentsOnly?: boolean;

  // Include subcategories in response (for tree building)
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeSubcategories?: boolean;
}
