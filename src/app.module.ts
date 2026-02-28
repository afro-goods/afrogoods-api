import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config } from './config';

// Feature modules
import { FirebaseModule } from 'src/firebase/firebase.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { SharedModule } from 'src/shared/shared.module';
import { ProductsModule } from 'src/product/product.module';
import { AttributesModule } from './attributes/attributes.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { AdvertsModule } from './adverts/adverts.module';
import { PaymentSettingsModule } from './payment-settings/payment-settings.module';
import { StripeModule } from './shared/stripe/stripe.module';
import { WebhooksModule } from './payment-settings/webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveryModule } from './delivery/delivery.module';
// import { PaymentModule } from './payments/payment.module';
import { CartModule } from './cart/cart.module';

const ServerModules = [
  ScheduleModule.forRoot(),
  MongooseModule.forRootAsync({
    useFactory: () => ({
      uri: config.database.uri,
    }),
  }),
  ThrottlerModule.forRoot({
    throttlers: [{ limit: 100, ttl: 60000 }],
  }),
];

const FeatureModules = [
  FirebaseModule,
  CartModule,
  UsersModule,
  AuthModule,
  SharedModule,
  AttributesModule,
  CategoriesModule,
  ProductsModule,
  OrdersModule,
  AdvertsModule,
  PaymentSettingsModule,
  StripeModule,
  WebhooksModule,
  DashboardModule,
  DeliveryModule,
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
export class AppModule { }
