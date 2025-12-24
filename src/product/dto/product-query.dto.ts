import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/shared/services/pagination/dto/pagination.dto';

export class ProductQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sort?: 'price' | '-price' | 'createdAt';
}
