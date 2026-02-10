import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ShippingCarrier } from '../enums/shipping-carrier.enum';

export class UpdateFulfillmentTrackingDto {
  @IsOptional()
  @IsEnum(ShippingCarrier)
  carrier?: ShippingCarrier;

  @IsString()
  trackingNumber: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;
}
