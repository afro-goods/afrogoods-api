import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class SalesAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month';
}
