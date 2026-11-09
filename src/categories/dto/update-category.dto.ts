import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsMongoId, ValidateIf } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['type', 'parentId'] as const),
) {
  // Allow moving subcategory to different parent (string ID or null to make it a parent)
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsMongoId()
  parentId?: string | null;
}
