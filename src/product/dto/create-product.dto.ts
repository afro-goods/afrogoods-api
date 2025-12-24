import {
  IsString,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { FileInput } from 'src/shared/inputs/file.input';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsMongoId()
  category: string;

  @IsNumber()
  price: number;

  @IsNumber()
  stock: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  images?: FileInput[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean;

  @IsOptional()
  @IsBoolean()
  isOrganic?: boolean;
}
