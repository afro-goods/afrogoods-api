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

  /**
   * Category ID - must reference a Category document with type 'advert'
   */
  @IsMongoId()
  @IsNotEmpty()
  category: string;

  /**
   * TARGET TYPE
   * product | category | collection | external | search
   */
  @IsString()
  @IsNotEmpty()
  targetType: AdvertTargetType;

  /**
   * TARGET VALUE
   * slug, id, or url depending on targetType
   */
  @ValidateIf((o) => o.targetType === AdvertTargetType.EXTERNAL)
  @IsUrl()
  @ValidateIf((o) => o.targetType !== AdvertTargetType.EXTERNAL)
  @IsString()
  @IsNotEmpty()
  targetValue: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  /* ---------- TYPE-SPECIFIC VALIDATION ---------- */

  // Jobs must have description
  @ValidateIf((o) => o.type === AdvertType.JOB)
  @IsString()
  @IsNotEmpty()
  jobDetails?: string;

  // Services must explain offering
  @ValidateIf((o) => o.type === AdvertType.SERVICE)
  @IsString()
  @IsNotEmpty()
  serviceDetails?: string;
}
