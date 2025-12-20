// generate-secret.ts
import crypto from 'crypto';

console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));
