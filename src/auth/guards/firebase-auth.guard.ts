import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject('FIREBASE_ADMIN') private readonly firebaseAdmin: admin.app.App,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decodedToken = await this.firebaseAdmin.auth().verifyIdToken(token);
      let user = await this.usersService.findByFirebaseUid(decodedToken.uid);

      if (!user && decodedToken.email) {
        const linked = await this.usersService.linkFirebaseUidByEmail(
          decodedToken.email,
          decodedToken.uid,
        );
        if (linked) user = linked;
      }

      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      request.user = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const message =
        error && typeof (error as any).message === 'string'
          ? (error as any).message
          : 'Invalid Firebase token';
      throw new UnauthorizedException(
        message.includes('expired') || message.includes('Expired')
          ? 'Firebase token has expired. Get a new token (e.g. run: npm run test:firebase-token)'
          : 'Invalid Firebase token',
      );
    }
  }
}
