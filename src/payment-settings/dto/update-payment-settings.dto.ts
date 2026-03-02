import {
  IsEmail,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsString,
  IsInt,
} from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsEmail()
  @IsOptional()
  eTransferEmail?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  paymentInstructions?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  expressDeliveryFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  standardDeliveryFee?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  advertDurationDays?: number;
}
