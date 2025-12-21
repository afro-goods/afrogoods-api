import { Global, Module } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { config } from 'src/config';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        if (!admin.apps.length) {
          const base64 = config.firebase.serviceAccountBase64;

          if (!base64) {
            throw new Error(
              'FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is missing',
            );
          }

          let serviceAccount: admin.ServiceAccount;

          try {
            const decoded = Buffer.from(base64, 'base64').toString('utf-8');
            serviceAccount = JSON.parse(decoded);
          } catch (error) {
            throw new Error(
              'Failed to decode or parse FIREBASE_SERVICE_ACCOUNT_BASE64',
              error,
            );
          }

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
