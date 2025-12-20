import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [UsersModule, FirebaseModule],
  controllers: [AuthController],
  providers: [],
  exports: [],
})
export class AuthModule {}
