import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { AdvertStatus } from '../enums/advert-status.enum';

export class ReviewAdvertDto {
  @IsEnum(AdvertStatus)
  status: AdvertStatus.APPROVED | AdvertStatus.REJECTED;

  @ValidateIf((o) => o.status === AdvertStatus.REJECTED)
  @IsNotEmpty({ message: 'Rejection reason is required when rejecting an advert' })
  @IsString()
  rejectionReason?: string;
}
