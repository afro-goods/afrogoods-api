import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdvertStatus } from '../enums/advert-status.enum';

export class ReviewAdvertDto {
  @IsEnum(AdvertStatus)
  status: AdvertStatus.APPROVED | AdvertStatus.REJECTED;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
