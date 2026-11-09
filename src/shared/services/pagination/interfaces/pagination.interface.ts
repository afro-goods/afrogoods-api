import type { QueryFilter, PopulateOptions, ProjectionType } from 'mongoose';

export interface PaginationOptions<T> {
  page?: number;
  limit?: number;
  filter?: QueryFilter<T>;
  sort?: Record<string, 1 | -1>;
  projection?: ProjectionType<T>;
  populate?: PopulateOptions | PopulateOptions[];
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
