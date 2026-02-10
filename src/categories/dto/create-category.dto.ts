import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryType } from '../enums/category-type.enum';
import { FileInput } from 'src/shared/inputs/file.input';

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

  // Optional parent for creating subcategories
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  // Optional image for category
  @IsOptional()
  @ValidateNested()
  @Type(() => FileInput)
  image?: FileInput;
}
