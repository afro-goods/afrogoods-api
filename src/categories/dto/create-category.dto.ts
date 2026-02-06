import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { CategoryType } from '../enums/category-type.enum';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
