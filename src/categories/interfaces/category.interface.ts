import { type CategoryType } from '../enums/category-type.enum';
import { type CategoryDocument } from '../schemas/category.schema';

export interface CategoryWithChildren {
  _id: string;
  name: string;
  description?: string;
  type: CategoryType;
  isActive: boolean;
  parentId: string | null;
  image?: string;
  subcategories?: CategoryWithChildren[];
  productCount?: number;
}

export interface CategoryTree {
  parents: CategoryWithChildren[];
}

export interface BatchCreateResult {
  parent: CategoryDocument;
  subcategories: CategoryDocument[];
  totalCreated: number;
}
