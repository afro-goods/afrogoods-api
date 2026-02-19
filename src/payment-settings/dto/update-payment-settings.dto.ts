import { IsEmail, IsNotEmpty, IsNumber, IsOptional, Min, IsString } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsEmail()
  @IsNotEmpty()
  eTransferEmail: string;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

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
}
