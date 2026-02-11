import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
