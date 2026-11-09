import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateDeliverySettingsDto {
  @IsOptional()
  @IsBoolean()
  deliveryAvailabilityEnabled?: boolean;

  @IsOptional()
  @IsString()
  calendlyApiToken?: string;

  @IsOptional()
  @IsString()
  calendlyEventTypeUri?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  cacheDurationMinutes?: number;
}
