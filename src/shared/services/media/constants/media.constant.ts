import type { Provider } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'src/config';

export const MEDIA = 'CLOUDINARY';

export const MediaProvider: Provider = {
  provide: MEDIA,
  useFactory: () => {
    return cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
  },
};
