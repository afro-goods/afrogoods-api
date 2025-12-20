import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject('FIREBASE_ADMIN') private readonly admin: any,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token missing');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const decoded = await this.admin.auth().verifyIdToken(token);

      let user = await this.usersService.findByFirebaseUid(decoded.uid);

      if (!user) {
        user = await this.usersService.create({
          firebaseUid: decoded.uid,
          email: decoded.email,
          role: 'user',
          firstName: decoded.name?.split(' ')[0] || 'First',
          lastName: decoded.name?.split(' ')[1] || 'Last',
        });
      }

      req.user = {
        id: user._id.toString(),
        firebaseUid: user.firebaseUid,
        email: user.email,
        username: user.username,
        role: user.role,
      };

      return true;
    } catch (error) {
      console.error('FirebaseAuthGuard error:', error);
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
