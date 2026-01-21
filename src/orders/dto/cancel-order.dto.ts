import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Cancellation reason cannot exceed 500 characters',
  })
  reason?: string;
}

export class CancelGuestOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Cancellation reason cannot exceed 500 characters',
  })
  reason?: string;
}
