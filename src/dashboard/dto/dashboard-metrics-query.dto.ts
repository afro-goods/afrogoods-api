import { IsOptional, IsDateString } from 'class-validator';

export class DashboardMetricsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
