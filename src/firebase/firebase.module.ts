import { Global, Module } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        if (!admin.apps.length) {
          const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
          if (!serviceAccountPath) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is missing');
          }

          // Resolve the full path from project root
          const fullPath = path.resolve(process.cwd(), serviceAccountPath);

          if (!fs.existsSync(fullPath)) {
            throw new Error(`Firebase service account file not found at ${fullPath}`);
          }

          const serviceAccount = require(fullPath);

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }

        return admin;
      },
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseModule {}
