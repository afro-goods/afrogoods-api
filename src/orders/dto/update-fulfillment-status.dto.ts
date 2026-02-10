import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FulfillmentStatus } from '../enums/fulfillment-status.enum';

export class UpdateFulfillmentStatusDto {
  @IsEnum(FulfillmentStatus)
  status: FulfillmentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
