import { IsBoolean, IsString, IsOptional, IsDateString } from 'class-validator';

export class AvailabilityStatusDto {
  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsDateString()
  nextAvailableDate?: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  calendlyLink?: string;
}
