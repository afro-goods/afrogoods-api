import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config } from './config';

import { FirebaseModule } from './firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SharedModule } from './shared/shared.module';
import { CartModule } from './cart/cart.module'; 

const ServerModules = [
  ScheduleModule.forRoot(),
  MongooseModule.forRootAsync({
    useFactory: () => ({
      uri: config.database.uri,
    }),
  }),
  ThrottlerModule.forRoot({
    throttlers: [{ limit: 10, ttl: 60000 }],
  }),
];

const FeatureModules = [
  FirebaseModule,
  UsersModule,
  AuthModule,
  SharedModule,
  CartModule, // ✅ REGISTERED
];

@Module({
  imports: [...ServerModules, ...FeatureModules],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
