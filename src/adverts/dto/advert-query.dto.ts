import { IsEnum, IsOptional, IsString, IsMongoId } from 'class-validator';
import { PaginationDto } from 'src/shared/services/pagination/dto/pagination.dto';
import { AdvertType } from '../enums/advert-type.enum';
import { AdvertStatus } from '../enums/advert-status.enum';

export class AdvertQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AdvertType)
  type?: AdvertType;

  @IsOptional()
  @IsMongoId()
  category?: string;

  @IsOptional()
  @IsEnum(AdvertStatus)
  status?: AdvertStatus;

  @IsOptional()
  @IsString()
  placement?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  /**
   * Internal flag set by controller to indicate admin query
   * Not exposed to external requests
   */
  isAdminQuery?: boolean;
}
