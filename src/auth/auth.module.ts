// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { FirebaseRegisterGuard } from './guards/firebase-register.guard';
import { FirebaseModule } from '../firebase/firebase.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [UsersModule, FirebaseModule, SharedModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard, FirebaseRegisterGuard],
  exports: [AuthService, FirebaseAuthGuard, FirebaseRegisterGuard],
})
export class AuthModule {}
