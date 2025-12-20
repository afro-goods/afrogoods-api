// Shared types for media uploads
export type MediaFolder =
  | 'products'
  | 'profiles'
  | 'banners'
  | 'categories'
  | 'brands'
  | 'reviews'
  | 'other';

export interface UploadOptions {
  folder?: MediaFolder;
  publicId?: string;
  overwrite?: boolean;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

export type UploadResult = {
  secure_url: string;
  public_id: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
};
