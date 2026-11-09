import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ArrayNotEmpty,
  IsDateString,
  ValidateIf,
  IsUrl,
  IsMongoId,
  MaxLength,
} from 'class-validator';
import { AdvertType } from '../enums/advert-type.enum';
import { AdvertTargetType } from '../enums/advert-target-type.enum';

export class CreateAdvertDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  images: string[];

  @IsEnum(AdvertType)
  type: AdvertType;

  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  targetType: AdvertTargetType;

  @ValidateIf((o) => o.targetType === AdvertTargetType.EXTERNAL)
  @IsUrl()
  @ValidateIf((o) => o.targetType !== AdvertTargetType.EXTERNAL)
  @IsString()
  @IsNotEmpty()
  targetValue: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsString()
  @IsNotEmpty()
  captchaToken: string;

  @ValidateIf((o) => o.type === AdvertType.JOB)
  @IsString()
  @IsNotEmpty()
  jobDetails?: string;

  @ValidateIf((o) => o.type === AdvertType.SERVICE)
  @IsString()
  @IsNotEmpty()
  serviceDetails?: string;
}
