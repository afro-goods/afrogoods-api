import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/enum/user.enum';
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
      const user = await this.usersService.findByFirebaseUid(decodedToken.uid);

      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      if (user.role === UserRole.ADMIN) {
        const previousLoginAt = (user as any).adminPreviousLoginAt as
          | Date
          | undefined;
        if (previousLoginAt) {
          const previousLoginAtSeconds = previousLoginAt.getTime() / 1000;
          if (decodedToken.iat < previousLoginAtSeconds) {
            throw new UnauthorizedException(
              'Session has been invalidated. Please log in again.',
            );
          }
        }
      }

      request.user = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}
