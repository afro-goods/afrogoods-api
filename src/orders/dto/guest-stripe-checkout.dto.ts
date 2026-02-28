import { IsEmail, IsNotEmpty } from 'class-validator';

export class GuestStripeCheckoutDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
