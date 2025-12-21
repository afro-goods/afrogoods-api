import { Injectable, Logger } from '@nestjs/common';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  DeleteApiResponse,
  ResourceApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { MediaFolder, UploadOptions } from '../interfaces/media.interface';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly rootFolder = 'afrogoods';

  async uploadFile(
    buffer: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadApiResponse> {
    const folder = options.folder || 'other';
    const fullFolder = `${this.rootFolder}/${folder}`;

    const uploadOptions = {
      folder: fullFolder,
      resource_type: options.resourceType || ('auto' as const),
      overwrite: options.overwrite ?? true,
      public_id: options.publicId,
    };

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            // logging
            this.logger.error('Cloudinary upload failed', error.message);
            return reject(
              new Error(error.message || 'Cloudinary upload failed'),
            );
          }
          if (!result) {
            return reject(new Error('No result returned from Cloudinary'));
          }
          // logging
          this.logger.log(`Upload successful: ${result.public_id}`);
          resolve(result);
        },
      );

      uploadStream.end(buffer);
    });
  }

  async getFile(publicId: string): Promise<ResourceApiResponse> {
    try {
      const result: ResourceApiResponse = (await cloudinary.api.resource(
        publicId,
      )) as ResourceApiResponse;
      return result;
    } catch (error) {
      this.logger.error(`Failed to get file: ${publicId}`, error);
      throw error instanceof Error
        ? error
        : new Error('Failed to get file from Cloudinary');
    }
  }

  async deleteFile(publicId: string): Promise<DeleteApiResponse> {
    try {
      const result: DeleteApiResponse = (await cloudinary.uploader.destroy(
        publicId,
        {
          invalidate: true,
        },
      )) as DeleteApiResponse;
      // logging
      this.logger.log(`Deleted from Cloudinary: ${publicId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${publicId}`, error);
      throw error instanceof Error
        ? error
        : new Error('Failed to delete file from Cloudinary');
    }
  }

  async deleteFolder(
    folder: MediaFolder,
  ): Promise<{ deleted: Record<string, string> }> {
    const fullPath = `${this.rootFolder}/${folder}`;

    try {
      // logging
      this.logger.warn(`Deleting all assets in folder: ${fullPath}`);

      await cloudinary.api.delete_resources_by_prefix(fullPath);
      // logging
      this.logger.log(`Deleting folder: ${fullPath}`);
      const result = (await cloudinary.api.delete_folder(fullPath)) as {
        deleted: Record<string, string>;
      };
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete folder: ${fullPath}`, error);
      throw error instanceof Error
        ? error
        : new Error('Failed to delete folder from Cloudinary');
    }
  }
}
