import {
  IsString,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FileInput } from 'src/shared/inputs/file.input';
import { CreateProductAttributeDto } from '../../attributes/dto/create-product-attribute.dto';

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

  @IsOptional()
  @IsString()
  availabilityStatus?: string;

  // New: Product tags
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // New: Product attributes (variants/options)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  attributes?: CreateProductAttributeDto[];
}
