import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config } from './config';

// Feature modules
// import { UserModule } from './users/user.module';
// import { AuthModule } from './authentication/auth.module';
// import { ProductModule } from './products/product.module';
// import { OrderModule } from './orders/order.module';
// import { PaymentModule } from './payments/payment.module';
// import { CartModule } from './carts/cart.module';
// import { ReviewModule } from './reviews/review.module';
// import { NotificationModule } from './notifications/notification.module';

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

const FeatureModules = []; // Add your feature modules here later

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
