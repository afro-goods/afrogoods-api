// // src/common/config/cloudinary.config.ts
// import { v2 as cloudinary } from 'cloudinary';
// import { config } from 'src/config';

// /**
//  * Initialize and configure Cloudinary
//  * This runs once at app startup
//  */
// export const configureCloudinary = (): void => {
//   cloudinary.config({
//     cloud_name: config.cloudinary.cloudName,
//     api_key: config.cloudinary.apiKey,
//     api_secret: config.cloudinary.apiSecret,
//     secure: true, // Always use HTTPS in production and dev
//   });
// };

// // Optional: Export the configured instance for direct use if needed
// export { cloudinary };


// src/common/providers/cloudinary.provider.ts
import { Provider } from '@nestjs/common';
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