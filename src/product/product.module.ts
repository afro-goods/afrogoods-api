import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './product.service';
import { ProductsController } from './product.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';
import { MediaService } from 'src/shared/services/media/services/media.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, PaginationService, MediaService],
})
export class ProductsModule {}
