import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttributeType } from '../enums/attribute.enum';

export class AttributeOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;
}

export class CreateProductAttributeDto {
  @IsString()
  title: string;

  @IsEnum(AttributeType)
  type: AttributeType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  options?: AttributeOptionDto[];
}
