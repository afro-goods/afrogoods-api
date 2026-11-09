import {
  IsString,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsEnum,
  IsInt,
  Min,
  MaxLength,
  ValidateIf,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FileInput } from 'src/shared/inputs/file.input';
import { CreateProductAttributeDto } from '../../attributes/dto/create-product-attribute.dto';
import { DeliveryTimeUnit } from '../enums/delivery-time-unit.enum';
import { DeliveryTimeRangeValidator } from '../validators/delivery-time-range.validator';

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
  images?: (FileInput | string)[];

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  attributes?: CreateProductAttributeDto[];

  @IsOptional()
  @IsEnum(DeliveryTimeUnit, {
    message: 'deliveryTimeUnit must be one of: days, hours, minutes',
  })
  deliveryTimeUnit?: DeliveryTimeUnit;

  @IsOptional()
  @ValidateIf(
    (o) => o.deliveryTimeUnit !== undefined || o.deliveryMinTime !== undefined,
  )
  @IsInt({ message: 'deliveryMinTime must be a positive integer' })
  @Min(1, { message: 'deliveryMinTime must be a positive integer' })
  deliveryMinTime?: number;

  @IsOptional()
  @ValidateIf(
    (o) => o.deliveryMinTime !== undefined || o.deliveryMaxTime !== undefined,
  )
  @IsInt({ message: 'deliveryMaxTime must be a positive integer' })
  @Min(1, { message: 'deliveryMaxTime must be a positive integer' })
  @Validate(DeliveryTimeRangeValidator)
  deliveryMaxTime?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'deliveryNote must not exceed 500 characters' })
  deliveryNote?: string;

  @IsOptional()
  @IsBoolean()
  requiresScheduledDelivery?: boolean;
}
