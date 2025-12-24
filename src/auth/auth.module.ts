import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { FirebaseRegisterGuard } from './guards/firebase-register.guard';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [UsersModule, FirebaseModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard, FirebaseRegisterGuard],
  exports: [AuthService, FirebaseAuthGuard, FirebaseRegisterGuard],
})
export class AuthModule {}
