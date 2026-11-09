import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationDto } from 'src/shared/services/pagination/dto/pagination.dto';
import { UserRole } from '../enum/user.enum';

export class GetUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  search?: string;
}
