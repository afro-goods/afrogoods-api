import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvertsController } from './adverts.controller';
import { AdvertsService } from './adverts.service';
import { Advert, AdvertSchema } from './schemas/advert.schema';
import { CategoriesModule } from '../categories/categories.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Advert.name, schema: AdvertSchema }]),
    CategoriesModule,
    SharedModule,
  ],
  controllers: [AdvertsController],
  providers: [AdvertsService],
  exports: [AdvertsService],
})
export class AdvertsModule {}
